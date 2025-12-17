// src/lib/command-processor.js
export function createCommandProcessor() {
    // Команды с паттернами (исправлены регулярные выражения)
    const commands = {
        'paragraph': {
            // patterns: [/\bабзац\b/i, /\bновая строка\b/i],
            patterns: [/абзац/i, /новая строка/i],
            action: 'addParagraph'
        },
        'undo': {
            // patterns: [/\bотменить\b/i, /\bотмена\b/i, /\bудали последнее\b/i],
            patterns: [/отменить/i, /отмена/i, /удали последнее/i],
            action: 'undoLastWord'
        },
        'save': {
            patterns: [/\bсохранить\b/i, /\bсохрани\b/i],
            action: 'saveNote'
        },
        'startRecording': {
            patterns: [/\bзапись\b/i, /\bначать запись\b/i],
            action: 'startRecording'
        },
        'stopRecording': {
            patterns: [/\bстоп запись\b/i, /\bостановить запись\b/i],
            action: 'stopRecording'
        }
    };

    // Преобразование "слово X" -> "X"
    const wordPatterns = [
        { pattern: /\bслово абзац\b/gi, replacement: 'абзац' },
        { pattern: /\bслово отменить\b/gi, replacement: 'отменить' },
        { pattern: /\bслово отмена\b/gi, replacement: 'отмена' },
        { pattern: /\bслово сохранить\b/gi, replacement: 'сохранить' },
        { pattern: /\bслово запись\b/gi, replacement: 'запись' }
    ];

    return {
        // Анализ текста на наличие команд
        analyze(text) {
            if (!text || !text.trim()) {
                return {
                    originalText: text || '',
                    processedText: text || '',
                    commands: []
                };
            }

            const lowerText = text.toLowerCase();
            const foundCommands = [];
            let processedText = text;

            console.log('🔍 Анализ текста на команды:', text);

            // 1. Сначала преобразуем "слово X" в "X"
            wordPatterns.forEach(({ pattern, replacement }) => {
                processedText = processedText.replace(pattern, replacement);
            });

            // 2. Ищем команды в ОРИГИНАЛЬНОМ тексте (не в processedText)
            Object.entries(commands).forEach(([cmdName, cmdConfig]) => {
                cmdConfig.patterns.forEach(pattern => {
                    if (pattern.test(text)) { // Ищем в оригинальном text
                        const match = text.match(pattern);
                        if (match) {
                            foundCommands.push({
                                name: cmdName,
                                action: cmdConfig.action,
                                pattern: pattern.toString(),
                                match: match[0]
                            });
                            console.log(`🔧 Найдена команда: ${cmdName} (${match[0]})`);
                        }
                    }
                });
            });

            // 3. Удаляем КОМАНДЫ из processedText (только команды undo и stopRecording)
            foundCommands.forEach(cmd => {
                if (['undo', 'stopRecording'].includes(cmd.name)) {
                    // Удаляем команду из processedText
                    const cmdRegex = new RegExp(cmd.match, 'gi');
                    processedText = processedText.replace(cmdRegex, '').trim();
                    processedText = processedText.replace(/\s+/g, ' ').trim();
                    console.log(`🗑️ Удалена команда "${cmd.match}" из текста`);
                }
            });

            // 4. Если нашли команды undo, нужно удалить слово ПЕРЕД командой
            const undoCommands = foundCommands.filter(cmd => cmd.name === 'undo');
            if (undoCommands.length > 0) {
                console.log('⚠️ Найдены команды undo, нужна специальная обработка');
                // Специальная обработка будет в Asr.svelte
            }

            return {
                originalText: text,
                processedText: processedText,
                commands: foundCommands
            };
        },

        // Для отладки
        getCommandsInfo() {
            return Object.entries(commands).map(([name, config]) => ({
                name,
                patterns: config.patterns.map(p => p.toString()),
                action: config.action
            }));
        },

        // Проверка конкретного текста на команду (для тестов)
        testCommand(text, commandName) {
            const cmd = commands[commandName];
            if (!cmd) return false;

            return cmd.patterns.some(pattern => pattern.test(text));
        }
    };
}
