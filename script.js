// script.js - Главный файл приложения
"use strict";

// Telegram WebApp Integration
class TelegramMiniApp {
    constructor() {
        this.tg = window.Telegram?.WebApp;
        this.user = null;
        this.init();
    }

    init() {
        if (this.tg) {
            console.log('Telegram WebApp обнаружен');
            this.tg.expand();
            this.tg.enableClosingConfirmation();
            this.setupMainButton();
            this.setupUserData();
            this.setupTheme();
        } else {
            console.log('Запущено вне Telegram, используется демо-режим');
            this.setupDemoMode();
        }
    }

    setupMainButton() {
        if (this.tg?.MainButton) {
            this.tg.MainButton.setText("Записаться на урок");
            this.tg.MainButton.onClick(() => this.openRegistration());
            this.tg.MainButton.show();
            this.tg.MainButton.setParams({
                color: '#0d9488',
                text_color: '#ffffff'
            });
        }
    }

    setupUserData() {
        if (this.tg?.initDataUnsafe?.user) {
            this.user = this.tg.initDataUnsafe.user;
            
            const userName = this.user.first_name || 'Пользователь';
            const userFullName = `${this.user.first_name || ''} ${this.user.last_name || ''}`.trim() || 'Ученик';
            
            this.updateUserUI(userName, userFullName);
        } else {
            this.updateUserUI('Гость', 'Демо-пользователь');
        }
    }

    updateUserUI(userName, fullName) {
        const elements = {
            'userName': userName,
            'userGreeting': userName,
            'profileName': fullName
        };
        
        for (const [id, text] of Object.entries(elements)) {
            const element = document.getElementById(id);
            if (element) element.textContent = text;
        }
    }

    setupTheme() {
        if (this.tg?.colorScheme) {
            const isDark = this.tg.colorScheme === 'dark';
            document.documentElement.style.setProperty('--bg', isDark ? '#1a1a1a' : '#f1f5f9');
            document.documentElement.style.setProperty('--card-bg', isDark ? '#2d2d2d' : '#ffffff');
            document.documentElement.style.setProperty('--dark', isDark ? '#ffffff' : '#1e293b');
            
            // Обновляем переключатель темы
            const darkModeToggle = document.getElementById('darkModeToggle');
            if (darkModeToggle) {
                darkModeToggle.checked = isDark;
            }
        }
    }

    setupDemoMode() {
        const telegramBtn = document.getElementById('telegramMainButton');
        if (telegramBtn) {
            telegramBtn.style.display = 'flex';
            telegramBtn.addEventListener('click', () => this.openRegistration());
        }
    }

    openRegistration() {
        if (this.tg) {
            this.tg.sendData(JSON.stringify({
                action: 'register_for_lesson',
                timestamp: Date.now(),
                user_id: this.user?.id
            }));
            
            this.showAlert('Запись на урок', 'Вы будете перенаправлены в чат с менеджером для записи на пробный урок.');
        } else {
            this.showAlert('Демо-режим', 'В реальном приложении здесь будет открыт чат с менеджером для записи на пробный урок.');
        }
    }

    showAlert(title, message) {
        if (this.tg?.showPopup) {
            this.tg.showPopup({
                title: title,
                message: message,
                buttons: [{ type: 'ok' }]
            });
        } else {
            alert(`${title}\n\n${message}`);
        }
    }

    showNotification(message, type = 'info') {
        const toast = document.getElementById('notificationToast');
        if (!toast) return;
        
        const iconMap = {
            'success': 'fas fa-check-circle',
            'error': 'fas fa-exclamation-circle',
            'info': 'fas fa-info-circle',
            'warning': 'fas fa-exclamation-triangle'
        };
        
        toast.querySelector('i').className = iconMap[type] || iconMap.info;
        document.getElementById('toastMessage').textContent = message;
        
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Основное приложение
class QuranFlowApp {
    constructor() {
        this.currentPage = 'dashboard';
        this.cardsPerDay = 5;
        this.cardsUsedToday = 0;
        this.currentCardIndex = 0;
        this.currentMode = 'new';
        this.currentCategory = 'all';
        this.flashcards = [];
        this.zikrCount = 0;
        this.currentZikrIndex = 0;
        this.zikrGoal = 100;
        this.map = null;
        this.prayerTimes = null;
        this.nextPrayerTimer = null;
        this.currentFactIndex = 0;
        
        // Данные из внешних файлов
        this.courses = window.coursesData || [];
        this.flashcards = window.flashcardsData || [];
        this.zikrList = window.zikrData || [];
        this.mosques = window.mosquesData || [];
        this.facts = window.factsData || [];
        
        // Инициализация
        this.init();
    }

    async init() {
        console.log('Инициализация QuranFlow Academy...');
        
        this.telegramApp = new TelegramMiniApp();
        this.setupEventListeners();
        this.updateUI();
        this.initializeCurrentPage();
        
        console.log('Приложение инициализировано');
        console.log('Загружено данных:', {
            курсы: this.courses.length,
            карточки: this.flashcards.length,
            зикры: this.zikrList.length,
            мечети: this.mosques.length,
            факты: this.facts.length
        });
    }

    setupEventListeners() {
        // Навигация
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.getAttribute('href').substring(1);
                this.navigateTo(page);
            });
        });

        // Быстрые действия
        document.querySelectorAll('.action-card').forEach(card => {
            card.addEventListener('click', () => {
                const action = card.dataset.action;
                if (action) this.handleQuickAction(action);
            });
        });

        // Курсы
        document.querySelectorAll('.gender-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.renderCourses(btn.dataset.gender);
            });
        });

        document.getElementById('trialLessonBtn')?.addEventListener('click', () => {
            this.telegramApp.openRegistration();
        });

        document.querySelectorAll('.faq-question').forEach(question => {
            question.addEventListener('click', () => {
                question.closest('.faq-item').classList.toggle('active');
            });
        });

        // Карточки
        const flashcard = document.getElementById('currentFlashcard');
        if (flashcard) {
            flashcard.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    flashcard.classList.toggle('flipped');
                }
            });
        }

        document.getElementById('nextCardBtn')?.addEventListener('click', () => this.nextCard());
        document.getElementById('prevCardBtn')?.addEventListener('click', () => this.prevCard());
        document.getElementById('knowBtn')?.addEventListener('click', () => this.markCardAsKnown());
        document.getElementById('dontKnowBtn')?.addEventListener('click', () => this.markCardForReview());
        document.getElementById('playAudioBtn')?.addEventListener('click', () => this.playCardAudio());
        document.getElementById('upgradeBtn')?.addEventListener('click', () => {
            document.getElementById('subscriptionModal').classList.add('active');
        });

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentMode = btn.dataset.mode;
                this.telegramApp.showNotification(`Режим изменен на: ${btn.textContent}`);
            });
        });

        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentCategory = btn.dataset.category;
                this.filterCardsByCategory(this.currentCategory);
            });
        });

        // Полезное - Табы
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tab;
                this.switchTab(tabId);
            });
        });

        // Зикр
        document.getElementById('increaseCount')?.addEventListener('click', () => {
            this.zikrCount = Math.min(this.zikrGoal, this.zikrCount + 1);
            this.updateZikrUI();
        });

        document.getElementById('decreaseCount')?.addEventListener('click', () => {
            this.zikrCount = Math.max(0, this.zikrCount - 1);
            this.updateZikrUI();
        });

        document.getElementById('resetZikrBtn')?.addEventListener('click', () => {
            this.zikrCount = 0;
            this.updateZikrUI();
            this.telegramApp.showNotification('Счетчик зикра сброшен', 'success');
        });

        document.getElementById('favoriteZikrBtn')?.addEventListener('click', () => {
            this.toggleFavoriteZikr();
        });

        document.getElementById('shareZikrBtn')?.addEventListener('click', () => {
            this.shareZikr();
        });

        // Факты
        document.getElementById('nextFactBtn')?.addEventListener('click', () => {
            this.showNextFact();
        });

        document.getElementById('saveFactBtn')?.addEventListener('click', () => {
            this.saveCurrentFact();
        });

        // Намаз
        document.getElementById('updateLocationBtn')?.addEventListener('click', () => {
            this.updateLocation();
        });

        document.getElementById('madhhabSelect')?.addEventListener('change', () => {
            this.loadPrayerTimes();
        });

        document.getElementById('methodSelect')?.addEventListener('change', () => {
            this.loadPrayerTimes();
        });

        // Мечети
        document.getElementById('femaleRoomFilter')?.addEventListener('change', () => {
            this.filterMosques();
        });

        document.getElementById('parkingFilter')?.addEventListener('change', () => {
            this.filterMosques();
        });

        document.getElementById('libraryFilter')?.addEventListener('change', () => {
            this.filterMosques();
        });

        // Профиль
        document.getElementById('fullScheduleBtn')?.addEventListener('click', () => {
            this.telegramApp.showAlert('Полное расписание', 'Открываем полное расписание занятий...');
        });

        document.getElementById('detailedStatsBtn')?.addEventListener('click', () => {
            this.telegramApp.showAlert('Подробная статистика', 'Открываем подробную статистику обучения...');
        });

        document.getElementById('allHomeworkBtn')?.addEventListener('click', () => {
            this.telegramApp.showAlert('Все задания', 'Открываем список всех домашних заданий...');
        });

        document.getElementById('messageTeacherBtn')?.addEventListener('click', () => {
            this.telegramApp.showAlert('Сообщение преподавателю', 'Открываем чат с преподавателем...');
        });

        document.getElementById('consultationBtn')?.addEventListener('click', () => {
            this.telegramApp.openRegistration();
        });

        document.getElementById('copyRefBtn')?.addEventListener('click', () => {
            this.copyReferralLink();
        });

        document.querySelectorAll('.share-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const platform = btn.dataset.platform;
                this.shareReferralLink(platform);
            });
        });

        document.getElementById('darkModeToggle')?.addEventListener('change', (e) => {
            this.toggleDarkMode(e.target.checked);
        });

        document.getElementById('notificationsToggle')?.addEventListener('change', (e) => {
            this.toggleNotifications(e.target.checked);
        });

        document.getElementById('languageSelect')?.addEventListener('change', (e) => {
            this.changeLanguage(e.target.value);
        });

        document.getElementById('privacyBtn')?.addEventListener('click', () => {
            this.telegramApp.showAlert('Конфиденциальность', 'Настройки конфиденциальности...');
        });

        document.getElementById('helpBtn')?.addEventListener('click', () => {
            this.telegramApp.showAlert('Помощь и поддержка', 'Открываем раздел помощи...');
        });

        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            this.logout();
        });

        // Модальные окна
        document.getElementById('closeModalBtn')?.addEventListener('click', () => {
            document.getElementById('subscriptionModal').classList.remove('active');
        });

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('subscriptionModal').classList.remove('active');
            });
        });

        document.getElementById('subscriptionModal')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('subscriptionModal') || 
                e.target.classList.contains('modal-overlay')) {
                document.getElementById('subscriptionModal').classList.remove('active');
            }
        });

        document.querySelectorAll('.price-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.price-option').forEach(o => o.classList.remove('active'));
                option.classList.add('active');
            });
        });

        document.getElementById('subscribeBtn')?.addEventListener('click', () => {
            this.subscribe();
        });

        // Прочие
        document.getElementById('studyAyahBtn')?.addEventListener('click', () => {
            this.telegramApp.showAlert('Аят дня', 'Открываем материалы для изучения этого аята...');
        });

        // Обновление времени
        setInterval(() => this.updateTime(), 60000);
        setInterval(() => this.updatePrayerCountdown(), 1000);
        
        // Сброс счетчиков в полночь
        this.setupDailyReset();
    }

    navigateTo(page) {
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
        });
        
        const targetPage = document.getElementById(page);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = page;
            
            document.querySelectorAll('.nav-link').forEach(link => {
                const linkPage = link.getAttribute('href').substring(1);
                link.classList.toggle('active', linkPage === page);
            });
            
            this.initializePage(page);
        }
    }

    initializePage(page) {
        switch(page) {
            case 'dashboard':
                this.updateDashboard();
                break;
            case 'courses':
                this.renderCourses('all');
                break;
            case 'flashcards':
                this.renderFlashcard();
                break;
            case 'useful':
                this.switchTab('zikr');
                break;
            case 'profile':
                this.loadProfileData();
                break;
        }
    }

    initializeCurrentPage() {
        const hash = window.location.hash.substring(1);
        const validPages = ['dashboard', 'courses', 'flashcards', 'useful', 'profile'];
        const page = validPages.includes(hash) ? hash : 'dashboard';
        this.navigateTo(page);
    }

    handleQuickAction(action) {
        switch(action) {
            case 'continue-lesson':
                this.telegramApp.showAlert('Продолжить урок', 'Открываем последний урок...');
                break;
            case 'flashcards':
                this.navigateTo('flashcards');
                break;
            case 'prayer-time':
                this.navigateTo('useful');
                this.switchTab('prayer');
                break;
        }
    }

    // Курсы
    renderCourses(gender) {
        const grid = document.getElementById('coursesGrid');
        if (!grid) return;
        
        let filteredCourses = this.courses;
        if (gender !== 'all') {
            filteredCourses = this.courses.filter(course => 
                course.gender === gender || course.gender === 'all'
            );
        }
        
        grid.innerHTML = filteredCourses.map(course => `
            <div class="course-card">
                <div class="course-badge">${course.gender === 'female' ? 'Для сестёр' : 'Для всех'}</div>
                <h3>${course.title}</h3>
                <p class="course-description">${course.description}</p>
                
                <div class="course-details">
                    <div class="detail-item">
                        <i class="fas fa-signal"></i>
                        <span>${course.level}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-clock"></i>
                        <span>${course.duration}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-book-open"></i>
                        <span>${course.lessons}</span>
                    </div>
                </div>
                
                <div class="course-features">
                    ${course.features.map(feature => 
                        `<span class="feature-tag">${feature}</span>`
                    ).join('')}
                </div>
                
                <div class="course-meta">
                    <span class="course-price">${course.price}</span>
                    <button class="btn-primary btn-sm" onclick="app.registerForCourse(${course.id})">
                        <i class="fas fa-calendar-check"></i> Записаться
                    </button>
                </div>
            </div>
        `).join('');
    }

    registerForCourse(courseId) {
        const course = this.courses.find(c => c.id === courseId);
        if (course) {
            this.telegramApp.showAlert(
                `Запись на курс: ${course.title}`,
                `Вы будете перенаправлены на запись на курс "${course.title}". Стоимость: ${course.price}.`
            );
        }
    }

    // Карточки
    renderFlashcard() {
        if (this.flashcards.length === 0) {
            console.error('Нет данных карточек');
            return;
        }
        
        const filteredCards = this.getFilteredCards();
        if (filteredCards.length === 0) {
            this.showNoCardsMessage();
            return;
        }
        
        if (this.currentCardIndex >= filteredCards.length) {
            this.currentCardIndex = 0;
        }
        
        const card = filteredCards[this.currentCardIndex];
        
        document.getElementById('cardArabic').textContent = card.arabic;
        document.getElementById('cardTranslation').textContent = card.translation;
        document.getElementById('cardTranscription').textContent = card.transcription;
        document.getElementById('cardExample').innerHTML = `<strong>Пример:</strong> ${card.example}`;
        document.getElementById('cardCategory').textContent = this.getCategoryName(card.category);
        
        const progress = ((this.currentCardIndex + 1) / filteredCards.length) * 100;
        document.getElementById('cardProgress').style.width = `${progress}%`;
        
        document.getElementById('currentCardNumber').textContent = this.currentCardIndex + 1;
        document.getElementById('totalCards').textContent = filteredCards.length;
        
        const cardsLeft = Math.max(0, this.cardsPerDay - this.cardsUsedToday);
        document.getElementById('cardsLeft').textContent = `${cardsLeft} карточек сегодня`;
        
        const nextBtn = document.getElementById('nextCardBtn');
        if (nextBtn) {
            if (cardsLeft <= 0 && this.currentMode === 'new') {
                nextBtn.disabled = true;
                nextBtn.innerHTML = '<i class="fas fa-lock"></i> Лимит';
            } else {
                nextBtn.disabled = false;
                nextBtn.innerHTML = 'Следующая <i class="fas fa-arrow-right"></i>';
            }
        }
        
        const flashcard = document.getElementById('currentFlashcard');
        if (flashcard) {
            flashcard.classList.remove('flipped');
        }
    }

    getFilteredCards() {
        if (this.currentCategory === 'all') {
            return this.flashcards;
        }
        return this.flashcards.filter(card => card.category === this.currentCategory);
    }

    getCategoryName(category) {
        const categories = {
            'home': 'Дом',
            'food': 'Еда',
            'prayer': 'Намаз',
            'religion': 'Религия',
            'education': 'Образование',
            'character': 'Характер'
        };
        return categories[category] || 'Общее';
    }

    showNoCardsMessage() {
        const container = document.querySelector('.flashcard-container');
        if (container) {
            container.innerHTML = `
                <div class="no-cards-message">
                    <i class="fas fa-inbox"></i>
                    <h3>Нет карточек в этой категории</h3>
                    <p>Выберите другую категорию или добавьте новые карточки</p>
                </div>
            `;
        }
    }

    nextCard() {
        if (this.currentMode === 'new' && this.cardsUsedToday >= this.cardsPerDay) {
            this.telegramApp.showNotification('Лимит карточек исчерпан. Оформите подписку для неограниченного доступа.', 'warning');
            return;
        }
        
        if (this.currentMode === 'new') {
            this.cardsUsedToday++;
        }
        
        const filteredCards = this.getFilteredCards();
        this.currentCardIndex = (this.currentCardIndex + 1) % filteredCards.length;
        this.renderFlashcard();
        this.updateStats();
    }

    prevCard() {
        const filteredCards = this.getFilteredCards();
        this.currentCardIndex = (this.currentCardIndex - 1 + filteredCards.length) % filteredCards.length;
        this.renderFlashcard();
    }

    markCardAsKnown() {
        this.telegramApp.showNotification('Отлично! Карточка добавлена в изученные.', 'success');
        this.nextCard();
    }

    markCardForReview() {
        this.telegramApp.showNotification('Карточка добавлена на повторение.', 'info');
        this.nextCard();
    }

    playCardAudio() {
        if ('speechSynthesis' in window) {
            const filteredCards = this.getFilteredCards();
            const card = filteredCards[this.currentCardIndex];
            const utterance = new SpeechSynthesisUtterance(card.arabic);
            utterance.lang = 'ar-SA';
            utterance.rate = 0.8;
            speechSynthesis.speak(utterance);
        } else {
            this.telegramApp.showNotification('Браузер не поддерживает синтез речи', 'warning');
        }
    }

    filterCardsByCategory(category) {
        this.currentCategory = category;
        this.currentCardIndex = 0;
        this.renderFlashcard();
        this.telegramApp.showNotification(`Показаны карточки категории: ${this.getCategoryName(category)}`, 'info');
    }

    updateStats() {
        const learned = Math.floor(Math.random() * 50) + 20;
        const review = Math.floor(Math.random() * 20) + 5;
        const accuracy = Math.floor(Math.random() * 20) + 80;
        
        document.getElementById('learnedCount').textContent = learned;
        document.getElementById('reviewCount').textContent = review;
        document.getElementById('accuracy').textContent = `${accuracy}%`;
    }

    // Полезное
    switchTab(tabId) {
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabId);
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabId}Tab`);
        });
        
        switch(tabId) {
            case 'zikr':
                this.initZikrTab();
                break;
            case 'fact':
                this.initFactTab();
                break;
            case 'prayer':
                this.initPrayerTab();
                break;
            case 'mosques':
                this.initMosquesTab();
                break;
        }
    }

    initZikrTab() {
        if (this.zikrList.length > 0) {
            this.currentZikrIndex = 0;
            const zikr = this.zikrList[this.currentZikrIndex];
            document.getElementById('zikrArabic').textContent = zikr.arabic;
            document.getElementById('zikrTranslation').textContent = zikr.translation;
            document.getElementById('zikrExplanation').textContent = zikr.explanation;
            document.getElementById('zikrReward').textContent = zikr.reward;
            document.getElementById('zikrTotal').textContent = zikr.count;
            this.zikrGoal = zikr.count;
            this.zikrCount = 0;
            this.updateZikrUI();
            this.loadFavoriteZikr();
        }
    }

    updateZikrUI() {
        document.getElementById('zikrCount').textContent = this.zikrCount;
        
        const progress = (this.zikrCount / this.zikrGoal) * 100;
        document.getElementById('zikrProgress').style.width = `${progress}%`;
        
        const favBtn = document.getElementById('favoriteZikrBtn');
        if (favBtn) {
            const isFavorite = favBtn.querySelector('i').classList.contains('fas');
            favBtn.innerHTML = isFavorite ? 
                '<i class="fas fa-heart"></i> В избранном' : 
                '<i class="far fa-heart"></i> В избранное';
        }
    }

    loadFavoriteZikr() {
        const list = document.getElementById('favoriteZikrList');
        if (!list) return;
        
        // Демо-данные избранных зикров
        const favorites = this.zikrList.slice(0, 2);
        
        list.innerHTML = favorites.map(zikr => `
            <div class="favorite-item">
                <div class="arabic-text-small">${zikr.arabic}</div>
                <span>${zikr.translation}</span>
            </div>
        `).join('');
    }

    toggleFavoriteZikr() {
        const btn = document.getElementById('favoriteZikrBtn');
        const icon = btn.querySelector('i');
        
        if (icon.classList.contains('far')) {
            icon.classList.remove('far');
            icon.classList.add('fas');
            this.telegramApp.showNotification('Зикр добавлен в избранное', 'success');
        } else {
            icon.classList.remove('fas');
            icon.classList.add('far');
            this.telegramApp.showNotification('Зикр удален из избранного', 'info');
        }
        
        this.updateZikrUI();
    }

    shareZikr() {
        const zikr = this.zikrList[this.currentZikrIndex];
        const text = `${zikr.arabic}\n${zikr.translation}\n\nQuranFlow Academy`;
        
        if (navigator.share) {
            navigator.share({
                title: 'Зикр дня',
                text: text,
                url: window.location.href
            });
        } else {
            navigator.clipboard.writeText(text).then(() => {
                this.telegramApp.showNotification('Зикр скопирован в буфер обмена', 'success');
            });
        }
    }

    initFactTab() {
        this.currentFactIndex = Math.floor(Math.random() * this.facts.length);
        this.showFact(this.currentFactIndex);
        this.loadSavedFacts();
    }

    showFact(index) {
        if (this.facts.length === 0) return;
        
        const fact = this.facts[index];
        document.getElementById('factText').textContent = fact.text;
        document.getElementById('factSource').textContent = `Источник: ${fact.source}`;
    }

    showNextFact() {
        this.currentFactIndex = (this.currentFactIndex + 1) % this.facts.length;
        this.showFact(this.currentFactIndex);
    }

    saveCurrentFact() {
        const fact = this.facts[this.currentFactIndex];
        this.telegramApp.showNotification(`Факт сохранен: "${fact.text.substring(0, 30)}..."`, 'success');
    }

    loadSavedFacts() {
        const list = document.getElementById('savedFactsList');
        if (!list) return;
        
        // Демо-данные сохраненных фактов
        const savedFacts = this.facts.slice(0, 1);
        
        list.innerHTML = savedFacts.map(fact => `
            <div class="history-item">
                <p>${fact.text.substring(0, 80)}...</p>
                <small>Добавлено: 2 дня назад</small>
            </div>
        `).join('');
    }

    initPrayerTab() {
        this.loadPrayerTimes();
        this.updatePrayerCountdown();
        this.updateDate();
    }

    async loadPrayerTimes() {
        const demoPrayerTimes = [
            { name: 'Фаджр', time: '05:30' },
            { name: 'Восход', time: '07:00' },
            { name: 'Зухр', time: '12:30' },
            { name: 'Аср', time: '15:45' },
            { name: 'Магриб', time: '18:20' },
            { name: 'Иша', time: '20:00' }
        ];
        
        this.prayerTimes = demoPrayerTimes;
        
        const container = document.getElementById('prayerTimes');
        if (container) {
            container.innerHTML = this.prayerTimes.map(prayer => `
                <div class="prayer-time-item">
                    <span class="prayer-name">${prayer.name}</span>
                    <span class="prayer-time">${prayer.time}</span>
                </div>
            `).join('');
        }
        
        this.updateNextPrayer();
    }

    updateNextPrayer() {
        if (!this.prayerTimes || this.prayerTimes.length === 0) return;
        
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        let nextPrayer = null;
        let nextTime = null;
        
        for (const prayer of this.prayerTimes) {
            const [hours, minutes] = prayer.time.split(':').map(Number);
            const prayerTime = hours * 60 + minutes;
            
            if (prayerTime > currentTime) {
                nextPrayer = prayer;
                nextTime = prayerTime;
                break;
            }
        }
        
        if (!nextPrayer) {
            nextPrayer = this.prayerTimes[0];
            const [hours, minutes] = nextPrayer.time.split(':').map(Number);
            nextTime = hours * 60 + minutes + 24 * 60;
        }
        
        document.getElementById('nextPrayerName').textContent = nextPrayer.name;
        document.getElementById('nextPrayerTime').textContent = nextPrayer.time;
        this.nextPrayerTime = nextTime;
    }

    updatePrayerCountdown() {
        if (!this.nextPrayerTime) return;
        
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
        
        let timeDiff = this.nextPrayerTime - currentTime;
        
        if (timeDiff < 0) {
            timeDiff += 24 * 60;
        }
        
        const hours = Math.floor(timeDiff / 60);
        const minutes = Math.floor(timeDiff % 60);
        const seconds = Math.floor((timeDiff * 60) % 60);
        
        const countdownElement = document.getElementById('countdownTimer');
        if (countdownElement) {
            countdownElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    updateLocation() {
        this.telegramApp.showNotification('Определение местоположения...', 'info');
        
        setTimeout(() => {
            this.telegramApp.showNotification('Местоположение обновлено: Москва, Россия', 'success');
        }, 1000);
    }

    initMosquesTab() {
        this.filterMosques();
        
        if (!this.map && document.getElementById('map')) {
            this.initMap();
        }
    }

    initMap() {
        try {
            this.map = L.map('map').setView([55.7558, 37.6173], 12);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(this.map);
            
            this.mosques.forEach(mosque => {
                const marker = L.marker([mosque.lat, mosque.lon]).addTo(this.map);
                
                const popupContent = `
                    <div style="padding: 10px; max-width: 250px;">
                        <h4 style="margin: 0 0 8px 0; color: #0d9488;">${mosque.name}</h4>
                        <p style="margin: 0 0 5px 0; font-size: 14px;">${mosque.address}</p>
                        <p style="margin: 0 0 5px 0; font-size: 14px;">📞 ${mosque.phone}</p>
                        <p style="margin: 0 0 5px 0; font-size: 14px;">🕒 ${mosque.schedule}</p>
                        <div style="margin-top: 8px;">
                            ${mosque.hasFemaleRoom ? '<span style="background: #10b981; color: white; padding: 3px 8px; border-radius: 12px; font-size: 12px; margin-right: 5px;">Женский зал</span>' : ''}
                            ${mosque.hasParking ? '<span style="background: #3b82f6; color: white; padding: 3px 8px; border-radius: 12px; font-size: 12px; margin-right: 5px;">Парковка</span>' : ''}
                            ${mosque.hasLibrary ? '<span style="background: #8b5cf6; color: white; padding: 3px 8px; border-radius: 12px; font-size: 12px;">Библиотека</span>' : ''}
                        </div>
                    </div>
                `;
                
                marker.bindPopup(popupContent);
            });
            
            console.log('Карта инициализирована');
        } catch (error) {
            console.error('Ошибка инициализации карты:', error);
        }
    }

    filterMosques() {
        const showFemaleRoom = document.getElementById('femaleRoomFilter').checked;
        const showParking = document.getElementById('parkingFilter').checked;
        const showLibrary = document.getElementById('libraryFilter').checked;
        
        const filteredMosques = this.mosques.filter(mosque => {
            if (showFemaleRoom && !mosque.hasFemaleRoom) return false;
            if (showParking && !mosque.hasParking) return false;
            if (showLibrary && !mosque.hasLibrary) return false;
            return true;
        });
        
        const list = document.getElementById('mosquesList');
        if (list) {
            list.innerHTML = filteredMosques.map(mosque => `
                <div class="mosque-item">
                    <div class="mosque-info">
                        <h4>${mosque.name}</h4>
                        <p class="mosque-meta">${mosque.address}</p>
                        <p class="mosque-meta">📞 ${mosque.phone} • 🕒 ${mosque.schedule}</p>
                    </div>
                    <div class="mosque-actions">
                        <div class="mosque-features">
                            ${mosque.hasFemaleRoom ? '<span class="badge" style="background: #10b981;">Женский зал</span>' : ''}
                            ${mosque.hasParking ? '<span class="badge" style="background: #3b82f6;">Парковка</span>' : ''}
                            ${mosque.hasLibrary ? '<span class="badge" style="background: #8b5cf6;">Библиотека</span>' : ''}
                        </div>
                        <div class="mosque-distance">~1.5 км</div>
                    </div>
                </div>
            `).join('');
        }
    }

    // Профиль
    loadProfileData() {
        const schedule = [
            { day: 'Сегодня', time: '19:00', course: 'Арабский для начинающих', status: 'active' },
            { day: 'Завтра', time: '18:00', course: 'Таджвид - правила нун сакина', status: 'upcoming' },
            { day: 'Среда', time: '20:00', course: 'Чтение Корана - сура Аль-Фатиха', status: 'upcoming' }
        ];
        
        const scheduleList = document.getElementById('scheduleList');
        if (scheduleList) {
            scheduleList.innerHTML = schedule.map(item => `
                <div class="schedule-item">
                    <div>
                        <strong>${item.day} ${item.time}</strong>
                        <p>${item.course}</p>
                    </div>
                    <button class="btn-outline btn-sm ${item.status === 'active' ? 'btn-primary' : ''}">
                        ${item.status === 'active' ? 'Присоединиться' : 'Напоминание'}
                    </button>
                </div>
            `).join('');
        }
        
        const homework = [
            { task: 'Выучить 10 новых слов из урока 5', due: 'до завтра', completed: false },
            { task: 'Прочитать суру Аль-Фатиха с таджвидом', due: 'до среды', completed: true },
            { task: 'Сделать упражнения по грамматике (стр. 45-48)', due: 'до пятницы', completed: false }
        ];
        
        const homeworkList = document.getElementById('homeworkList');
        if (homeworkList) {
            homeworkList.innerHTML = homework.map(item => `
                <div class="homework-item ${item.completed ? 'completed' : ''}">
                    <div>
                        <strong>${item.task}</strong>
                        <p>Срок: ${item.due}</p>
                    </div>
                    ${item.completed ? 
                        '<span class="badge" style="background: var(--success)">Выполнено</span>' : 
                        '<button class="btn-primary btn-sm">Сделать</button>'}
                </div>
            `).join('');
        }
        
        const refCount = 2;
        const refRemaining = 3 - refCount;
        const refReward = refCount >= 3 ? 1 : 0;
        
        document.getElementById('refCount').textContent = refCount;
        document.getElementById('refRemaining').textContent = refRemaining;
        document.getElementById('refReward').textContent = refReward;
    }

    copyReferralLink() {
        const linkInput = document.getElementById('referralLink');
        if (!linkInput) return;
        
        linkInput.select();
        linkInput.setSelectionRange(0, 99999);
        
        navigator.clipboard.writeText(linkInput.value).then(() => {
            this.telegramApp.showNotification('Ссылка скопирована в буфер обмена', 'success');
        }).catch(() => {
            document.execCommand('copy');
            this.telegramApp.showNotification('Ссылка скопирована в буфер обмена', 'success');
        });
    }

    shareReferralLink(platform) {
        const link = document.getElementById('referralLink').value;
        let shareUrl = '';
        
        switch(platform) {
            case 'telegram':
                shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Присоединяйся к QuranFlow Academy!')}`;
                break;
            case 'whatsapp':
                shareUrl = `https://wa.me/?text=${encodeURIComponent('Присоединяйся к QuranFlow Academy! ' + link)}`;
                break;
            case 'copy':
                this.copyReferralLink();
                return;
        }
        
        if (shareUrl) {
            window.open(shareUrl, '_blank');
            this.telegramApp.showNotification(`Ссылка открыта в ${platform === 'telegram' ? 'Telegram' : 'WhatsApp'}`, 'info');
        }
    }

    toggleDarkMode(enabled) {
        if (enabled) {
            document.documentElement.style.setProperty('--bg', '#1a1a1a');
            document.documentElement.style.setProperty('--card-bg', '#2d2d2d');
            document.documentElement.style.setProperty('--dark', '#ffffff');
            document.documentElement.style.setProperty('--gray-100', '#2d2d2d');
            document.documentElement.style.setProperty('--gray-200', '#3d3d3d');
            this.telegramApp.showNotification('Темная тема включена', 'success');
        } else {
            document.documentElement.style.setProperty('--bg', '#f1f5f9');
            document.documentElement.style.setProperty('--card-bg', '#ffffff');
            document.documentElement.style.setProperty('--dark', '#1e293b');
            document.documentElement.style.setProperty('--gray-100', '#f3f4f6');
            document.documentElement.style.setProperty('--gray-200', '#e5e7eb');
            this.telegramApp.showNotification('Темная тема выключена', 'info');
        }
    }

    toggleNotifications(enabled) {
        this.telegramApp.showNotification(
            enabled ? 'Уведомления включены' : 'Уведомления выключены',
            enabled ? 'success' : 'info'
        );
    }

    changeLanguage(lang) {
        const languages = {
            'ru': 'Русский',
            'en': 'Английский',
            'ar': 'Арабский'
        };
        this.telegramApp.showNotification(`Язык изменен на: ${languages[lang]}`, 'info');
    }

    logout() {
        if (confirm('Вы уверены, что хотите выйти?')) {
            this.telegramApp.showNotification('Выход из аккаунта...', 'info');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }
    }

    // Модальные окна
    subscribe() {
        const selectedPlan = document.querySelector('.price-option.active').dataset.plan;
        const planName = selectedPlan === 'monthly' ? 'Ежемесячная' : 'Годовая';
        
        this.telegramApp.showAlert(
            'Оформление подписки',
            `Вы выбрали тариф: ${planName}. В реальном приложении здесь будет открыта форма оплаты через Telegram Payments.`
        );
        
        document.getElementById('subscriptionModal').classList.remove('active');
        this.cardsPerDay = 999;
        this.updateUI();
        this.telegramApp.showNotification('Подписка активирована! Теперь у вас неограниченный доступ.', 'success');
    }

    // Обновление интерфейса
    updateUI() {
        const dailyCardsElement = document.getElementById('dailyCards');
        if (dailyCardsElement) {
            const cardsLeft = Math.max(0, this.cardsPerDay - this.cardsUsedToday);
            dailyCardsElement.textContent = `${cardsLeft}/${this.cardsPerDay}`;
            
            if (cardsLeft <= 2) {
                dailyCardsElement.style.background = 'var(--warning)';
            } else {
                dailyCardsElement.style.background = 'var(--primary)';
            }
        }
        
        this.updateDashboard();
    }

    updateDashboard() {
        const now = new Date();
        const nextLesson = new Date(now.getTime() + 3 * 60 * 60 * 1000);
        
        const nextLessonElement = document.getElementById('nextLesson');
        if (nextLessonElement) {
            nextLessonElement.textContent = 
                `Сегодня в ${nextLesson.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} - Арабский для начинающих`;
        }
        
        const stats = {
            streakDays: Math.floor(Math.random() * 30) + 1,
            wordsLearned: Math.floor(Math.random() * 100) + 20,
            progressPercent: Math.floor(Math.random() * 30) + 70
        };
        
        document.getElementById('streakDays').textContent = stats.streakDays;
        document.getElementById('wordsLearned').textContent = stats.wordsLearned;
        document.getElementById('progressPercent').textContent = `${stats.progressPercent}%`;
    }

    updateDate() {
        const now = new Date();
        const islamicMonths = [
            'Мухаррам', 'Сафар', 'Раби аль-авваль', 'Раби ас-сани', 
            'Джумада аль-уля', 'Джумада ас-сания', 'Раджаб', 'Шаабан',
            'Рамадан', 'Шавваль', 'Зуль-каада', 'Зуль-хиджа'
        ];
        
        const hijriDate = `15 ${islamicMonths[9]} 1445`; // Пример даты
        document.getElementById('currentDate').textContent = hijriDate;
    }

    updateTime() {
        this.updatePrayerCountdown();
    }

    setupDailyReset() {
        const now = new Date();
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const timeUntilMidnight = tomorrow - now;
        
        setTimeout(() => {
            this.cardsUsedToday = 0;
            this.zikrCount = 0;
            this.updateUI();
            this.updateZikrUI();
            this.telegramApp.showNotification('Доброе утро! Счетчики сброшены.', 'info');
            this.setupDailyReset();
        }, timeUntilMidnight);
    }
}

// Инициализация приложения
let app;

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM загружен, инициализация приложения...');
    
    const toast = document.getElementById('notificationToast');
    if (toast) {
        toast.querySelector('#toastMessage').textContent = 'Приложение загружается...';
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }
    
    app = new QuranFlowApp();
    window.app = app;
    
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.substring(1);
        const validPages = ['dashboard', 'courses', 'flashcards', 'useful', 'profile'];
        const page = validPages.includes(hash) ? hash : 'dashboard';
        if (app) {
            app.navigateTo(page);
        }
    });
    
    console.log('Приложение готово к использованию!');
});

// Обработка ошибок
window.addEventListener('error', function(e) {
    console.error('Глобальная ошибка:', e.error);
    
    const toast = document.getElementById('notificationToast');
    if (toast) {
        toast.querySelector('#toastMessage').textContent = 'Произошла ошибка. Пожалуйста, обновите страницу.';
        toast.querySelector('i').className = 'fas fa-exclamation-triangle';
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 5000);
    }
});