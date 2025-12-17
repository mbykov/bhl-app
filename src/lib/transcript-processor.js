// src/lib/transcript-processor.js
export function createTranscriptProcessor() {
    let currentSegment = 0;
    let currentSegmentText = '';
    let lastProcessedTranscript = '';

    return {
        // Основной метод: обработка транскрипции от ASR
        process(transcriptData, currentNote, editDiv) {
            if (!transcriptData?.text?.trim()) return null;

            const transcript = transcriptData.text.trim();
            const segment = transcriptData.segment || 0;

            console.log('🎤 Транскрипция:', transcript, 'сегмент:', segment);

            // Защита от дублирования
            if (transcript === lastProcessedTranscript && segment === currentSegment) {
                console.log('⏭️ Пропускаем дубликат');
                return null;
            }
            lastProcessedTranscript = transcript;

            // Обработка сегментов
            return this.processWithSegments(transcript, segment, currentNote, editDiv);
        },

        // Обработка с учетом сегментов
        processWithSegments(transcript, segment, currentNote, editDiv) {
            if (!currentNote) return null;

            console.log('_segment__________________', currentSegment, segment);

            if (segment !== currentSegment) {
                // НОВЫЙ СЕГМЕНТ: сохраняем предыдущий
                if (currentSegmentText) {
                    this.commitSegment(currentNote);
                    console.log('💾 Завершен сегмент:', currentSegmentText);
                }

                // Начинаем новый сегмент
                currentSegment = segment;
                currentSegmentText = transcript;
                console.log('🔄 Начат новый сегмент:', transcript);
            } else {
                // ТОТ ЖЕ СЕГМЕНТ: заменяем текст
                currentSegmentText = transcript;
                console.log('✏️ Обновлен текущий сегмент:', transcript);
            }

            // Обновляем отображение
            return this.updateDisplay(currentNote, editDiv);
        },

        // Обновление отображения
        updateDisplay(currentNote, editDiv) {
            const separator = currentNote.content && !currentNote.content.endsWith(' ') ? ' ' : '';
            const displayText = currentNote.content + separator + currentSegmentText;

            if (editDiv) {
                editDiv.textContent = displayText;
            }

            console.log('📝 Отображаемый текст:', displayText);

            return {
                segment: currentSegment,
                segmentText: currentSegmentText,
                displayText: displayText
            };
        },

        // Сохранение текущего сегмента в заметку
        commitSegment(currentNote) {
            if (!currentSegmentText) return;

            const separator = currentNote.content && !currentNote.content.endsWith(' ') ? ' ' : '';
            currentNote.content += separator + currentSegmentText + ' ';
            currentNote.updatedAt = new Date();
            currentNote.wordCount = currentNote.content.split(/\s+/).filter(w => w.length > 0).length;

            // Автогенерация заголовка
            if (currentNote.draft && !currentNote.title && currentNote.content.trim()) {
                const firstWords = currentNote.content.split(/\s+/).slice(0, 5).join(' ');
                currentNote.title = firstWords || 'Черновик';
            }

            currentSegmentText = '';
            console.log('💾 Сегмент сохранен в заметку');
        },

        // Очистка текущего сегмента
        clearSegment() {
            const clearedText = currentSegmentText;
            currentSegmentText = '';
            console.log('🗑️ Очищен сегмент:', clearedText);
            return clearedText;
        },

        // Сброс
        reset() {
            currentSegment = 0;
            currentSegmentText = '';
            lastProcessedTranscript = '';
            console.log('🔄 Процессор сброшен');
        },

        // Геттеры
        getCurrentSegment() { return currentSegment; },
        getSegmentText() { return currentSegmentText; },
        getLastProcessed() { return lastProcessedTranscript; }
    };
}
