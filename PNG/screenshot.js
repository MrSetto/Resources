const puppeteer = require('puppeteer');
const { exec } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');

async function getFileHash(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        stream.on('data', data => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

async function captureAndUpload() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Устанавливаем прозрачный фон
    await page.setViewport({ width: 800, height: 600 });
    await page.goto('https://www.donationalerts.com/widget/goal/6875377?token=MHqeARjVfrhCaQcCNvNc', {
        waitUntil: 'networkidle2'
    });

    // Включаем альфа-канал для скриншота
    await page.evaluate(() => {
        document.body.style.background = 'transparent';
    });

    const imagePath = 'widget_image.png';
    const tempImagePath = 'widget_image_temp.png';
    
    // Сделаем временный снимок, чтобы сравнить с предыдущим
    await page.screenshot({ path: tempImagePath, omitBackground: true });
    await browser.close();

    console.log('Изображение успешно сохранено с альфа-каналом.');

    // Сравним хэш текущего файла и нового файла
    const oldHash = fs.existsSync(imagePath) ? await getFileHash(imagePath) : null;
    const newHash = await getFileHash(tempImagePath);

    if (oldHash === newHash) {
        console.log("Изображение не изменилось, коммит не требуется.");
        fs.unlinkSync(tempImagePath); // Удаляем временный файл
        return;
    }

    // Обновляем старое изображение новым
    fs.renameSync(tempImagePath, imagePath);

    // Получаем текущее время
    const currentTime = new Date().toLocaleString();

    // Выполняем Git команды
    exec(`git add ${imagePath}`, (error, stdout, stderr) => {
        if (error) {
            console.log(`Ошибка при выполнении git add: ${error.message}`);
            console.log(`Git stderr: ${stderr}`);
            return;
        }
        console.log(`Git add успешно: ${stdout}`);
        
        exec(`git commit -m "Updated widget image at ${currentTime}"`, (error, stdout, stderr) => {
            if (error) {
                console.log(`Ошибка при выполнении git commit: ${error.message}`);
                console.log(`Git stderr: ${stderr}`);
                return;
            }
            console.log(`Git commit успешно: ${stdout}`);
            
            exec(`git push`, (error, stdout, stderr) => {
                if (error) {
                    console.log(`Ошибка при выполнении git push: ${error.message}`);
                    console.log(`Git stderr: ${stderr}`);
                    return;
                }
                console.log(`Git push успешно: ${stdout}`);
                console.log("Изображение успешно отправлено на GitHub.");
            });
        });
    });
}

// Функция с циклом выполнения каждые 20 секунд
async function startProcess() {
    while (true) {
        await captureAndUpload();
        console.log("Ждём 30 секунд перед следующим запуском...");
        await new Promise(resolve => setTimeout(resolve, 30000)); // Задержка на 20 секунд
    }
}

// Запуск процесса
startProcess();
