import express from 'express';
import dotenv from 'dotenv';
import { Midjourney } from 'midjourney';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static('public'));

const client = new Midjourney({
  SalaiToken: process.env.MIDJOURNEY_USER_TOKEN,
  ServerId: process.env.MIDJOURNEY_SERVER_ID,
  ChannelId: process.env.MIDJOURNEY_CHANNEL_ID,
  DMChannelId: process.env.MIDJOURNEY_DM_CHANNEL_ID,
  Debug: true,
  Ws: true
});

const jobs = {};

// Добавляем хранилище для сидов
const seedHistory = new Map();

const CLEANUP_INTERVAL = 1000 * 60 * 60; 
const JOB_LIFETIME = 1000 * 60 * 60 * 24; 

function cleanupJobs() {
  const now = Date.now();
  Object.entries(jobs).forEach(([key, job]) => {
    if (now - job.createdAt > JOB_LIFETIME) {
      delete jobs[key];
    }
  });
}

setInterval(cleanupJobs, CLEANUP_INTERVAL);

(async () => {
  try {
    await client.init();
    console.log('Connected to Midjourney');
  } catch (err) {
    console.error('Connection error:', err);
  }
})();


function validateGenerateInput(data) {
  const requiredFields = ['adjective', 'nationality', 'age', 'gender', 'hairstyle'];
  for (const field of requiredFields) {
    if (!data[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
}

app.post('/generate', async (req, res) => {
  try {
    validateGenerateInput(req.body);
    const prompt = createPrompt(
      req.body, 
      req.body.referenceUrl,
      req.body.referenceWeight || 100,
      req.body.seed
    );
    const imagineResult = await client.Imagine(prompt);

    if (!imagineResult || !imagineResult.id) {
      return res.status(500).json({ error: 'Imagine error' });
    }

    console.log('Imagine result:', imagineResult);

    // Автоматически нажимаем кнопку конверта для получения seed
    try {
      const response = await fetch(
        `https://discord.com/api/v9/channels/${process.env.MIDJOURNEY_CHANNEL_ID}/messages/${imagineResult.id}/reactions/%E2%9C%89%EF%B8%8F/@me`,
        {
          method: 'PUT',
          headers: {
            'Authorization': process.env.MIDJOURNEY_USER_TOKEN,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
          }
        }
      );
      
      if (response.ok) {
        console.log('Envelope button clicked successfully');
      } else {
        console.error('Failed to click envelope button:', await response.text());
      }
    } catch (err) {
      console.error('Error clicking envelope button:', err);
    }

    // Ждем немного дольше, так как теперь нам нужно дождаться и генерации, и отправки в DM
    const waitTime = 5000; // 5 секунд вместо 3
    await new Promise(resolve => setTimeout(resolve, waitTime));

    // Try to get seed from DM with retries
    let seed = null;
    const maxRetries = 3;
    const retryDelay = 3000; // 3 секунды вместо 2

    for (let i = 0; i < maxRetries && !seed; i++) {
      if (i > 0) {
        console.log(`Retry ${i} to get seed from DM...`);
      }

      try {
        // Получаем сообщения из DM канала
        const dmResponse = await fetch(
          `https://discord.com/api/v9/channels/${process.env.MIDJOURNEY_DM_CHANNEL_ID}/messages?limit=10`,
          {
            headers: {
              'Authorization': process.env.MIDJOURNEY_USER_TOKEN,
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            }
          }
        );

        if (!dmResponse.ok) {
          throw new Error(`Failed to get DM messages: ${await dmResponse.text()}`);
        }

        const dmMessages = await dmResponse.json();
        console.log('Received DM messages:', JSON.stringify(dmMessages, null, 2));

        // Ищем сообщение с seed
        const seedMessage = dmMessages.find(msg => {
          // Проверяем основные условия
          const isMidjourneyBot = msg.author?.username === 'Midjourney Bot';
          const hasSeed = msg.content?.includes('**seed**');
          const hasJobId = msg.content?.includes('Job ID');
          
          console.log('Message check:', {
            isMidjourneyBot,
            hasSeed,
            hasJobId,
            content: msg.content?.substring(0, 100)
          });
          
          return isMidjourneyBot && hasSeed && hasJobId;
        });

        if (seedMessage) {
          console.log('Found seed message:', seedMessage.content);
          
          // Используем более точное регулярное выражение для поиска seed
          const seedMatch = seedMessage.content.match(/\*\*seed\*\*\s*(\d+)/i);
          
          if (seedMatch) {
            seed = seedMatch[1];
            console.log('Successfully extracted seed:', seed);
            
            // Сразу же сохраняем seed в историю
            const jobKey = uuidv4();
            const historyEntry = {
              seed,
              prompt: req.body,
              timestamp: Date.now(),
              imageUrl: imagineResult.uri
            };
            
            seedHistory.set(jobKey, historyEntry);
            console.log('Saved seed to history. Entry:', historyEntry);
            
            // Сохраняем информацию о задании
            jobs[jobKey] = {
              id: imagineResult.id,
              flags: imagineResult.flags,
              options: imagineResult.options,
              prompt,
              uri: imagineResult.uri,
              createdAt: Date.now(),
              seed
            };
            
            // Возвращаем результат
            return res.json({
              collageUrl: imagineResult.uri,
              jobKey,
              seed,
              success: true
            });
          }
        }
      } catch (err) {
        console.error(`Error getting seed from DM (attempt ${i + 1}):`, err);
      }
    }

    // Если seed не найден после всех попыток
    console.log('No seed found in DM after all retries');
    
    const jobKey = uuidv4();
    jobs[jobKey] = {
      id: imagineResult.id,
      flags: imagineResult.flags,
      options: imagineResult.options,
      prompt,
      uri: imagineResult.uri,
      createdAt: Date.now()
    };

    return res.json({
      collageUrl: imagineResult.uri,
      jobKey,
      success: true
    });
  } catch (err) {
    console.error('Generate error:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/upscale', async (req, res) => {
  try {
    const { jobKey, variantIndex } = req.body;
    if (!jobs[jobKey]) {
      return res.status(400).json({ error: 'Invalid jobKey' });
    }
    if (!variantIndex || variantIndex < 1 || variantIndex > 4) {
      return res.status(400).json({ error: 'variantIndex must be between 1 and 4' });
    }

    const { id, flags, options, prompt } = jobs[jobKey];
    const label = `U${variantIndex}`;
    const customId = options?.find((o) => o.label === label)?.custom;

    if (!customId) {
      return res.status(500).json({ error: `Upscale option ${label} not found` });
    }

    const upscaled = await client.Custom({
      msgId: id,
      flags,
      customId,
      content: prompt
    });

    if (!upscaled || !upscaled.uri) {
      return res.status(500).json({ error: 'Upscale error' });
    }

    return res.json({ upscaledUrl: upscaled.uri });
  } catch (err) {
    console.error('Upscale error:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/seeds', (req, res) => {
  const seeds = Array.from(seedHistory.entries())
    .map(([jobKey, data]) => ({
      jobKey,
      ...data
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
  res.json(seeds);
});

app.get('/debug/seeds', (req, res) => {
  const history = {
    size: seedHistory.size,
    entries: Array.from(seedHistory.entries()).map(([key, value]) => ({
      key,
      ...value,
      timestamp: new Date(value.timestamp).toISOString()
    }))
  };
  res.json(history);
});

function createPrompt(data, referenceUrl = null, referenceWeight = 100, seed = null) {
  const age = data.age || '';
  const adjective = data.adjective || '';
  const nationality = data.nationality ? data.nationality + ' ' : '';
  const gender = data.gender || '';
  
  const cleanAccessory = data.accessory?.replace(/_/g, ' ') || '';
  const cleanHairstyle = data.hairstyle?.replace(/_/g, ' ') || '';
  const cleanProfession = data.profession?.replace(/_/g, ' ') || '';
  
  const accessory = cleanAccessory ? `, wearing ${cleanAccessory}` : '';
  const hairstyle = cleanHairstyle ? `, with ${cleanHairstyle} hair` : '';
  const profession = cleanProfession ? `, ${cleanProfession}` : '';

  let prompt = `
Apple iOS Memoji-style avatar of ${age} ${nationality}${gender}${profession}${accessory}${hairstyle}, identical to official Apple Memoji. Simple, clean, and cartoon-like, exactly in the Apple aesthetic. The face has ${adjective} expression. The background is pure white. No extra details, no unnecessary rendering--just the classic iOS Memoji style.
`.trim();

  const params = [
    `--v ${data.mjVersion}`,
    `--s ${data.stylize}`,
    `--q ${data.quality}`,
    `--c ${data.chaos}`,
    `--ar ${data.aspectRatio}`,
    data.raw ? '--style raw' : ''
  ];

  // Добавляем seed для версий 5.1 и 5.2
  if (['5.1', '5.2'].includes(data.mjVersion) && seed) {
    params.push(`--seed ${seed}`);
  }

  // Добавляем референс только для версий 6.0+
  if (parseFloat(data.mjVersion) >= 6.0 && referenceUrl) {
    const finalWeight = Math.min(referenceWeight, 15);
    params.push(`--cref ${referenceUrl} --cw ${finalWeight}`);
  }

  return prompt + ' ' + params.filter(Boolean).join(' ');
}

app.listen(3000, () => {
  console.log('Server running on port 3000');
});