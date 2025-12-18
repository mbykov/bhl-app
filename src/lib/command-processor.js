// $lib/command-processor.js

// Команды с полными фразами
const COMMANDS = [
    {
        name: 'undo',
        synonyms: ['отмена', 'отменить'],
        pattern: /(отмена|отменить)$/i
    },
    {
        name: 'paragraph',
        synonyms: ['абзац', 'с новой строки', 'новая строка'],
        pattern: /(абзац|с новой строки|новая строка)$/i
    },
    {
        name: 'saveNote',
        synonyms: ['сохранить', 'сохранить заметку'],
        pattern: /(сохранить|сохранить заметку)$/i
    },
    {
        name: 'record',
        synonyms: ['запись', 'начать запись'],
        pattern: /(запись|начать запись)$/i
    },
    {
        name: 'stop',
        synonyms: ['стоп', 'стоп запись'],
        pattern: /(стоп|стоп запись)$/i
    }
];

// Инициализируем паттерны
COMMANDS.forEach(cmd => {
    const escapedSynonyms = cmd.synonyms.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    cmd.pattern = new RegExp(`\\s*(${escapedSynonyms.join('|')})\\s*$`, 'i');
});

/**
 * Обрабатывает сегмент текста, извлекает команду (если есть)
 * @param {string} text - Текст сегмента
 * @returns {Object} { text: очищенный текст, command: имя команды или null, original: оригинальный текст }
 */
export function processSegment(text) {
    if (!text || !text.trim()) {
        return { text: '', command: null, original: '' };
    }

    const original = text.trim();
    let cleanedText = original;
    let foundCommand = null;

    // Ищем команду в конце текста
    for (const cmd of COMMANDS) {
        const match = original.match(cmd.pattern);
        if (match) {
            foundCommand = cmd.name;
            // Удаляем команду из текста
            cleanedText = original.replace(cmd.pattern, '').trim();
            break;
        }
    }

    return {
        text: cleanedText,
        command: foundCommand,
        original: original,
        hasCommand: foundCommand !== null
    };
}

/**
 * Выполняет команду над текущим состоянием заметки
 * @param {string} commandName - Имя команды
 * @param {string} textBeforeCommand - Текст до команды
 * @param {string} currentNoteContent - Текущее содержимое заметки
 * @returns {Object} { newContent: новое содержимое, action: дополнительное действие }
 */
export function executeCommand(commandName, textBeforeCommand, currentNoteContent = '') {
    // console.log('🔧 EXECUTE COMMAND вызван:');
    // console.log('- Команда:', commandName);
    // console.log('- Текст до команды:', textBeforeCommand);
    // console.log('- Текущее содержимое заметки:', currentNoteContent);

    let newContent = currentNoteContent || '';
    const action = { type: 'none' };

    // Добавляем текст перед командой (если есть)
    if (textBeforeCommand.trim()) {
        newContent = addTextWithSpace(newContent, textBeforeCommand);
    }

    switch (commandName) {
    case 'undo':
        // Удаляем последнее слово из заметки
        if (newContent.trim()) {
            const words = newContent.trim().split(/\s+/);
            if (words.length > 0) {
                words.pop(); // Удаляем последнее слово
                newContent = words.join(' ');
                if (words.length > 0) {
                    newContent += ' ';
                }
            }
        }
        break;

    case 'paragraph':
        // Добавляем абзац
        newContent = addTextWithSpace(newContent, '\n\n');
        break;

    case 'saveNote':
        // Сохраняем заметку
        action.type = 'save';
        break;

    case 'record':
        // Начать запись
        action.type = 'startRecording';
        break;

    case 'stop':
        // Остановить запись
        action.type = 'stopRecording';
        break;

    default:
        // Неизвестная команда - просто добавляем текст
        console.warn(`Неизвестная команда: ${commandName}`);
    }

    return { newContent, action };
}

/**
 * Добавляет текст с правильным пробелом
 */
function addTextWithSpace(existingText, textToAdd) {
    if (!textToAdd) return existingText;

    if (!existingText) {
        return textToAdd;
    }

    // Если добавляем абзац, не добавляем лишний пробел
    if (textToAdd === '\n\n') {
        return existingText + textToAdd;
    }

    // Проверяем, нужно ли добавить пробел
    const lastChar = existingText[existingText.length - 1];
    const firstChar = textToAdd[0];

    if (lastChar === ' ' || lastChar === '\n' || firstChar === ' ' || firstChar === '\n') {
        return existingText + textToAdd;
    } else {
        return existingText + ' ' + textToAdd;
    }
}

/**
 * Определяет, содержит ли текст команду
 */
export function containsCommand(text) {
    if (!text) return false;
    return COMMANDS.some(cmd => text.match(cmd.pattern));
}
