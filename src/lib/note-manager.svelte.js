// src/lib/note-manager.svelte.js
import { tick } from 'svelte';

export class NoteManager {
    // Состояние
    paragraphs = $state([]);
    selectedIndex = $state(-1);
    tempText = $state('');
    isWriting = $state(true);
    isChanged = $state(false);

    // История команд
    #undoStack = [];
    #maxStackSize = 20;

    // Приватные поля
    #records = null;
    #currentNote = null;
    #oredactor = null;
    #commandDiv = null;
    #commandName = null;
    #commandTimer = null;
    #log = console.log;

    // Колбэки
    onDeleteNote = null;
    onNavigateToList = null;

    constructor(records, currentNote) {
        this.#records = records;
        this.#currentNote = currentNote;
        this.paragraphs = currentNote?.paragraphs || [];
        this.selectedIndex = this.paragraphs.length - 1;
        this.tempText = '';
        this.isWriting = true;
        this.isChanged = false;
    }

    // Установка DOM элементов
    setDomElements(oredactor, commandDiv, commandName) {
        this.#oredactor = oredactor;
        this.#commandDiv = commandDiv;
        this.#commandName = commandName;
    }

    // Сохраняем состояние в историю
    #pushToHistory() {
        const state = {
            paragraphs: JSON.parse(JSON.stringify(this.paragraphs)),
            selectedIndex: this.selectedIndex,
            tempText: this.tempText
        };

        this.#undoStack.push(state);

        // Ограничиваем размер
        if (this.#undoStack.length > this.#maxStackSize) {
            this.#undoStack.shift();
        }
    }

    // Отмена последней команды
    async undoCommand() {
        if (this.#undoStack.length === 0) {
            this.toggleCommandDiv('Нечего отменять');
            return;
        }

        // Восстанавливаем предыдущее состояние
        const previousState = this.#undoStack.pop();
        this.paragraphs = previousState.paragraphs;
        this.selectedIndex = previousState.selectedIndex;
        this.tempText = previousState.tempText;

        this.toggleCommandDiv('Отменено');
        await this.focusCurrentParagraph();
    }

    // Обертка для команд, которые изменяют данные
    async #executeWithHistory(command) {
        this.#pushToHistory();
        await command();
    }

    // Основной обработчик транскрипта
    async handleTranscript(data) {
        const now = new Date();
        const localTime = now.toLocaleString('ru-RU');
        console.log('⏭️ START handleTranscript:', localTime, data);

        if (data.text === 'recordStart') this.isWriting = true;
        if (!this.isWriting) return;

        if (data.type === 'command') {
            this.tempText = '';
            await this.handleCommand(data);
        } else if (data.type === 'correct') {
            this.tempText = '';

            if (this.selectedIndex === -1) {
                await this.createNewParagraph();
            }

            let target = this.paragraphs[this.selectedIndex];

            if (target && target.type !== 'text') {
                await this.createNewParagraph();
                target = this.paragraphs[this.selectedIndex];
            }

            if (target && target.type === 'text') {
                target.phrases.push(data.text.trim());
                this.paragraphs[this.selectedIndex] = target;
            }

            await tick();
            await this.focusCurrentParagraph();

        } else if (data.type === 'interim') {
            this.tempText = data.text;
        }

        if (this.#oredactor) {
            this.#oredactor.scrollTo({ top: this.#oredactor.scrollHeight, behavior: 'smooth' });
        }
    }

    // Обработка команд
    async handleCommand(data) {
        this.#log('_handleCommand data.name', data.name);

        switch (data.name) {
        case 'saveNote':
            await this.#executeWithHistory(() => this.saveNote());
            break;

        case 'clearText':
            await this.#executeWithHistory(() => this.clearCurrentNote());
            break;

        case 'newParagraph':
            console.log('Command data new Par:', data);
            await this.#executeWithHistory(async () => {
                await this.createNewParagraph();
            });
            break;

            case 'killParagraph':
                await this.#executeWithHistory(() => {
                    this.killParagraph();
                });
                break;

            case 'undoPhrase':
                await this.#executeWithHistory(() => {
                    this.undoPhrase();
                });
                break;

            case 'undoCommand':
                await this.undoCommand();
                break;

            case 'killNote':
                // killNote - без истории
                this.killNote();
                break;

            case 'recordStart':
                this.#log('___recordStart');
                this.isWriting = true;
                break;

            case 'recordStop':
                this.isWriting = false;
                break;

            case 'recordNew':
                if (this.onStopRecording) this.onStopRecording();
                this.isWriting = false;
                this.#currentNote.title = this.generateTitle();
                if (this.onNavigateToList) this.onNavigateToList();
                break;

            default:
                this.#log('_DEFAULT', data.text);
        }

        await tick();
        await this.focusCurrentParagraph();

        console.log('_toggleCommandDiv', data)
        let commandText = data.description || data.name;
        this.toggleCommandDiv(commandText);
    }

    // Вставка LaTeX блока (для external команд)
    async insertLatexBlock(data) {
        await this.#executeWithHistory(async () => {
            const newLatex = {
                id: crypto.randomUUID(),
                type: 'latex',
                text: data.text || '',
                latex: data.latex || '',
                flipped: false
            };

            const insertAt = this.selectedIndex === -1 ?
                this.paragraphs.length :
                this.selectedIndex + 1;

            this.paragraphs.splice(insertAt, 0, newLatex);
            this.selectedIndex = insertAt;

            if (this.#oredactor) {
                this.#oredactor.scrollTo({ top: this.#oredactor.scrollHeight, behavior: 'smooth' });
            }
        });
    }

    // Создание нового параграфа
    async createNewParagraph() {
        const newPar = {
            id: crypto.randomUUID(),
            type: 'text',
            phrases: []
        };

        this.paragraphs.push(newPar);
        this.selectedIndex = this.paragraphs.length - 1;
        await this.focusCurrentParagraph();
    }

    // Отмена последней фразы
    undoPhrase() {
        this.commitCurrentParagraph();
        if (this.paragraphs[this.selectedIndex]?.phrases) {
            this.paragraphs[this.selectedIndex].phrases.pop();
        }
    }

    // Удаление последнего параграфа
    killParagraph() {
        if (this.paragraphs.length > 0) {
            this.paragraphs.pop();
            this.selectedIndex = this.paragraphs.length - 1;
        }
    }

    // Удаление заметки
    killNote() {
        if (this.#currentNote && this.#currentNote.id !== 'draft_current') {
            if (this.onDeleteNote) {
                this.onDeleteNote(this.#currentNote.id);
            }
            this.toggleCommandDiv('Заметка удалена');
        } else {
            // Если черновик, просто очищаем
            this.clearCurrentNote();
        }
    }

    // Очистка текущей заметки
    async clearCurrentNote() {
        this.tempText = '';

        this.paragraphs = [
            { id: crypto.randomUUID(), type: 'text', phrases: [] }
        ];

        this.selectedIndex = 0;

        if (this.#currentNote) {
            this.#currentNote.paragraphs = [];
            this.#currentNote.title = 'Новая заметка';
        }

        await this.focusCurrentParagraph();
        this.toggleCommandDiv('Очищено');
    }

    // Сохранение заметки
    async saveNote() {
        this.commitCurrentParagraph();

        this.#currentNote.paragraphs = this.paragraphs;

        if (this.#currentNote.id === 'draft_current') {
            this.#currentNote.id = crypto.randomUUID();
        }

        this.#currentNote.draft = false;
        this.#currentNote.title = this.generateTitle();
        this.#currentNote.updatedAt = new Date();

        this.toggleCommandDiv('Сохранено');
        this.#log('_saved note', this.#currentNote);

        if (this.onNavigateToList) this.onNavigateToList();
    }

    // Генерация заголовка
    generateTitle() {
        const firstPar = this.paragraphs[0];
        if (!firstPar) return 'Новая заметка';

        const firstPhrase = firstPar.phrases?.[0];
        if (!firstPhrase) return 'Новая заметка';

        return firstPhrase.slice(0, 50) + '...';
    }

    // Фиксация текущего редактируемого параграфа
    commitCurrentParagraph() {
        if (!this.isChanged) return;

        const active = document.activeElement;
        if (active && active.isContentEditable) {
            const wrapper = active.closest('[data-paragraph-index]');
            if (wrapper) {
                const index = parseInt(wrapper.dataset.paragraphIndex);
                if (!isNaN(index) &&
                    this.paragraphs[index] &&
                    this.paragraphs[index].type === 'text') {
                    const text = active.textContent.trim();
                    const newphrases = text.match(/[^.!?]+[.!?]?/g)?.map(s => s.trim()) || [];
                    this.paragraphs[index].phrases = newphrases;
                    this.isChanged = false;
                }
            }
        }
    }

    // Фокус на текущий параграф
    async focusCurrentParagraph() {
        await tick();

        if (!this.#oredactor) return;

        const targetWrapper = this.#oredactor.querySelector(`[data-paragraph-index="${this.selectedIndex}"]`);
        if (!targetWrapper) return;

        const targetEl = targetWrapper.querySelector('[contenteditable="true"]');
        if (targetEl) {
            this.placeCaretAtEnd(targetEl);
        }
    }

    // Установка курсора в конец
    placeCaretAtEnd(el) {
        el.focus();
        if (typeof window.getSelection !== "undefined" &&
            typeof document.createRange !== "undefined") {
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }

    // Отображение команды в UI
    toggleCommandDiv(command) {
        console.log('toggleCommandDiv called:', {
            command,
            hasCommandDiv: !!this.#commandDiv,
            hasCommandName: !!this.#commandName,
            commandDiv: this.#commandDiv,
            commandName: this.#commandName
        });

        if (!this.#commandDiv || !this.#commandName) {
            console.warn('DOM elements not set!');
            return;
        }

        this.#commandName.textContent = command;
        console.log('Before remove hidden, classes:', this.#commandDiv.className);
        this.#commandDiv.classList.remove('hidden');
        console.log('After remove hidden, classes:', this.#commandDiv.className);

        if (this.#commandTimer) clearTimeout(this.#commandTimer);
        this.#commandTimer = setTimeout(() => {
            console.log('Hiding command div');
            if (this.#commandDiv) this.#commandDiv.classList.add('hidden');
        }, 3000);
    }

    // Обработка изменения в редакторе
    handleEditorChange(ev) {
        if (!this.isChanged) return;
        this.isChanged = false;

        const text = ev.target.textContent.trim();
        const matches = text.match(/[^.!?]+[.!?]?/g);
        const newphrases = matches ? matches.map(s => s.trim()) : [];

        if (this.paragraphs[this.selectedIndex]?.type === 'text') {
            this.paragraphs[this.selectedIndex].phrases = newphrases;
        }
    }

    // Метод для отметки изменения
    markChanged() {
        this.isChanged = true;
    }

    // Выбор параграфа
    selectParagraph(index) {
        this.selectedIndex = index;
    }

    // Колбэки
    onStopRecording = null;
}
