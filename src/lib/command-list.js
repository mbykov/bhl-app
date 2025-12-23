export const COMMANDS = [
    {
        name: 'undo',
        synonyms: ['отмена', 'отмени'],
        system: false,
    },
    {
        name: 'addParagraph',
        synonyms: ['новый абзац', 'с новой строки', 'новая строка'],
        system: false,
    },
    {
        name: 'saveNote',
        synonyms: ['сохранить', 'сохранить запись'],
        system: true,
    },
    {
        name: 'cleanNote',
        synonyms: ['очисти запись', 'очисти текст'],
        system: true,
    },
    {
        name: 'recordStart',
        synonyms: ['начать запись'],
        system: true,
    },
    {
        name: 'recordStop',
        synonyms: ['стоп запись'],
        system: true,
    }
];
