// Управление отображением полей в зависимости от версии Midjourney
document.getElementById('mjVersion').addEventListener('change', function() {
    const version = this.value;
    const seedGroup = document.getElementById('seedGroup');
    const referenceGroup = document.getElementById('referenceGroup');
    const seedSection = document.querySelector('.seed-section');

    // Управление полем seed
    if (version.startsWith('5')) {
        seedGroup.style.display = 'block';
        seedSection.style.display = 'block';
    } else {
        seedGroup.style.display = 'none';
        seedSection.style.display = 'none';
    }

    // Управление полями reference
    if (version.startsWith('6')) {
        referenceGroup.style.display = 'block';
    } else {
        referenceGroup.style.display = 'none';
    }
});

// Обработка отправки формы
document.getElementById('generateForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const generateButton = document.getElementById('generateButton');
    const resultDiv = document.getElementById('result');
    
    // Блокируем кнопку на время генерации
    generateButton.disabled = true;
    generateButton.textContent = 'Generating...';
    
    // Показываем индикатор загрузки
    resultDiv.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';

    try {
        // Собираем данные формы
        const formData = new FormData(this);
        const data = Object.fromEntries(formData.entries());

        // Преобразуем значения в нужные типы
        data.stylize = parseInt(data.stylize);
        data.quality = parseInt(data.quality);
        data.chaos = parseInt(data.chaos);
        data.raw = data.raw === 'true';

        // Удаляем пустые значения
        Object.keys(data).forEach(key => {
            if (data[key] === '') {
                delete data[key];
            }
        });

        // Добавляем дополнительные параметры для разных версий
        if (data.mjVersion.startsWith('6') && data.referenceUrl) {
            data.referenceWeight = parseInt(data.referenceWeight) || 10;
        }

        console.log('Sending data:', data); // Для отладки

        // Отправляем запрос на сервер
        const response = await fetch('/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Generation failed');
        }

        const result = await response.json();

        if (result.success) {
            console.log('Raw server response:', result);
            console.log('Server response URL:', result.collageUrl);

            // Extract jobKey from the last part of the URL before .png
            let jobKey;
            let messageId;

            if (result.collageUrl) {
                // Example URL: .../vsechp_Apple_iOS_Memoji-style_avatar_of_young_caucasus_female_w_d0852601-6dc5-4c30-8aac-7d0793277799.png
                const urlParts = result.collageUrl.split('_');
                const lastPart = urlParts[urlParts.length - 1];
                jobKey = lastPart.split('.')[0];
                console.log('Extracted jobKey from URL:', jobKey);

                // Extract messageId from Discord URL
                const messageMatch = result.collageUrl.match(/attachments\/\d+\/(\d+)\//);
                if (messageMatch) {
                    messageId = messageMatch[1];
                    console.log('Extracted messageId from URL:', messageId);
                }
            }

            // Store essential data from server response
            const generationData = {
                jobKey: jobKey,
                channelId: "997264440858779729",
                messageId: messageId,
                timestamp: Date.now()
            };
            
            console.log('Final data to store:', generationData);
            
            // Save to window
            window.currentJobKey = jobKey;
            window.currentChannelId = "997264440858779729";
            window.currentMessageId = messageId;
            window.currentSessionId = crypto.randomUUID().replace(/-/g, '');
            
            try {
                localStorage.setItem('lastGenerationData', JSON.stringify(generationData));
                console.log('Saved to localStorage:', generationData);
            } catch (e) {
                console.error('Failed to save to localStorage:', e);
            }
            
            console.log('Generation successful. Stored data:', generationData);
            
            // Показываем результат
            resultDiv.innerHTML = `
                <div class="collage-title">Collage of 4 variants</div>
                <div class="collage-grid">
                    <img src="${result.collageUrl}" alt="Generated avatars">
                </div>
                ${result.seed ? `<div class="seed-label">Generated with seed: ${result.seed}</div>` : ''}
                <div class="upscale-controls card">
                    <div class="upscale-buttons">
                        <button class="upscale-button" data-variant="1">U1</button>
                        <button class="upscale-button" data-variant="2">U2</button>
                        <button class="upscale-button" data-variant="3">U3</button>
                        <button class="upscale-button" data-variant="4">U4</button>
                    </div>
                    <div id="upscaled"></div>
                </div>
            `;

            // Если есть seed, добавляем его в историю
            if (result.seed) {
                updateSeedHistory(result);
            }

            // Добавляем обработчики для кнопок апскейла
            document.querySelectorAll('.upscale-button').forEach(button => {
                button.addEventListener('click', handleUpscale);
            });
        } else {
            throw new Error(result.error || 'Generation failed');
        }
    } catch (error) {
        console.error('Error:', error);
        resultDiv.innerHTML = `
            <div class="error-message">
                Error: ${error.message}
            </div>
        `;
    } finally {
        // Разблокируем кнопку
        generateButton.disabled = false;
        generateButton.textContent = 'Generate Avatar';
    }
});

// Функция обновления истории seeds
function updateSeedHistory(result) {
    const seedHistory = document.getElementById('seedHistory');
    const timestamp = new Date().toLocaleString();
    
    const seedItem = document.createElement('div');
    seedItem.className = 'seed-item';
    seedItem.innerHTML = `
        <div class="seed-info">
            <div class="seed-number">Seed: ${result.seed}</div>
            <div class="seed-details">
                ${timestamp}
            </div>
        </div>
    `;

    // Добавляем новый seed в начало истории
    seedHistory.insertBefore(seedItem, seedHistory.firstChild);
}

// Обработка применения seed
document.getElementById('mjVersion').addEventListener('change', function() {
    const version = this.value;
    const seedGroup = document.getElementById('seedGroup');
    const referenceGroup = document.getElementById('referenceGroup');
    const seedSection = document.querySelector('.seed-section');

    if (version.startsWith('5')) {
        seedGroup.style.display = 'block';
        seedSection.style.display = 'block';
    } else {
        seedGroup.style.display = 'none';
        seedSection.style.display = 'none';
    }

    if (version.startsWith('6')) {
        referenceGroup.style.display = 'block';
    } else {
        referenceGroup.style.display = 'none';
    }
});

// Обработка отправки формы
document.getElementById('generateForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const generateButton = document.getElementById('generateButton');
    const resultDiv = document.getElementById('result');

    generateButton.disabled = true;
    generateButton.textContent = 'Generating...';

    resultDiv.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';

    try {
        const formData = new FormData(this);
        const data = Object.fromEntries(formData.entries());

        data.stylize = parseInt(data.stylize);
        data.quality = parseInt(data.quality);
        data.chaos = parseInt(data.chaos);
        data.raw = data.raw === 'true';

        Object.keys(data).forEach(key => {
            if (data[key] === '') delete data[key];
        });

        const response = await fetch('/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Generation failed');
        }

        const result = await response.json();

        if (result.success) {
            window.currentJobKey = result.jobKey;
            window.currentChannelId = result.channelId;
            window.currentMessageId = result.messageId;
            window.currentSessionId = crypto.randomUUID().replace(/-/g, '');

            const generationData = {
                jobKey: result.jobKey,
                channelId: result.channelId,
                messageId: result.messageId,
                timestamp: Date.now()
            };

            localStorage.setItem('lastGenerationData', JSON.stringify(generationData));

            resultDiv.innerHTML = `
                <div class="collage-title">Collage of 4 variants</div>
                <div class="collage-grid">
                    <img src="${result.collageUrl}" alt="Generated avatars">
                </div>
                ${result.seed ? `<div class="seed-label">Generated with seed: ${result.seed}</div>` : ''}
                <div class="upscale-controls card">
                    <div class="upscale-buttons">
                        <button class="upscale-button" data-variant="1">U1</button>
                        <button class="upscale-button" data-variant="2">U2</button>
                        <button class="upscale-button" data-variant="3">U3</button>
                        <button class="upscale-button" data-variant="4">U4</button>
                    </div>
                    <div id="upscaled"></div>
                </div>
            `;

            document.querySelectorAll('.upscale-button').forEach(button => {
                button.addEventListener('click', handleUpscale);
            });

            if (result.seed) updateSeedHistory(result);

        } else {
            throw new Error(result.error || 'Generation failed');
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
    } finally {
        generateButton.disabled = false;
        generateButton.textContent = 'Generate Avatar';
    }
});

// Функция обработки апскейла
async function handleUpscale(event) {
    const button = event.currentTarget;
    const variantIndex = parseInt(button.dataset.variant, 10);
    const upscaledDiv = document.getElementById('upscaled');

    document.querySelectorAll('.upscale-button').forEach(btn => btn.disabled = true);
    upscaledDiv.innerHTML = '<div class="loading">Upscaling...</div>';

    try {
        const requestData = {
            jobKey: window.currentJobKey,
            variantIndex: variantIndex
        };

        const response = await fetch('/upscale', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });

        const result = await response.json();

        if (!response.ok || !result.upscaledUrl) {
            throw new Error(result.error || 'Upscale failed');
        }

        upscaledDiv.innerHTML = `
            <div class="upscaled-result">
                <img src="${result.upscaledUrl}" alt="Upscaled variant ${variantIndex}" class="upscaled-image">
                <div class="upscale-info">
                    <div>JobKey: ${window.currentJobKey}</div>
                    <div>Variant: ${variantIndex}</div>
                </div>
            </div>
        `;
    } catch (error) {
        upscaledDiv.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
    } finally {
        document.querySelectorAll('.upscale-button').forEach(btn => btn.disabled = false);
    }
}


// Добавляем стили для кнопок
const style = document.createElement('style');
style.textContent = `
    .upscale-buttons {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
    }
    
    .upscale-button {
        padding: 8px 16px;
        background-color: #5865F2;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
    }
    
    .upscale-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    .upscale-button:hover:not(:disabled) {
        background-color: #4752C4;
    }
`;
document.head.appendChild(style);

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Восстанавливаем данные последней генерации
    const savedData = localStorage.getItem('lastGenerationData');
    if (savedData) {
        const data = JSON.parse(savedData);
        // Проверяем, не старше ли данные 24 часов
        if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
            window.currentJobKey = data.jobKey;
            window.currentChannelId = data.channelId;
            window.currentMessageId = data.messageId;
            console.log('Restored generation data:', data);
        } else {
            localStorage.removeItem('lastGenerationData');
        }
    }

    document.getElementById('mjVersion').dispatchEvent(new Event('change'));
});

document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.querySelector('.theme-toggle');
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  });
}); 