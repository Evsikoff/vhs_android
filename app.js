// ==========================================
// VHS Tape Trader - Main Game Logic
// ==========================================

class VHSTraderGame {
    constructor() {
        // Game state
        this.balance = 500;
        this.day = 1;
        this.soldUnique = new Set();
        this.soldTotal = 0;
        this.shelf = []; // 10 slots
        this.ownedFilms = new Set(); // films we own (on shelf or in inventory)
        this.inventory = []; // extra films not on shelf

        // Day state
        this.currentCustomerIndex = 0;
        this.todayCustomers = [];
        this.currentRequest = null;
        this.selectedSlot = null;
        this.isDay = false;
        this.isEvening = false;

        // Win conditions
        this.UNIQUE_WIN = 50;
        this.TOTAL_WIN = 100;

        // DOM elements
        this.initializeDOM();
        this.bindEvents();
        this.initializeGame();
    }

    initializeDOM() {
        // Stats
        this.balanceEl = document.getElementById('balance');
        this.soldUniqueEl = document.getElementById('sold-unique');
        this.soldTotalEl = document.getElementById('sold-total');
        this.dayNumberEl = document.getElementById('day-number');

        // Customer
        this.customerAvatarEl = document.getElementById('customer-avatar');
        this.customerRequestEl = document.getElementById('customer-request');
        this.currentCustomerEl = document.getElementById('current-customer');
        this.totalCustomersEl = document.getElementById('total-customers');

        // Shelf
        this.shelfEl = document.getElementById('shelf');

        // Buttons
        this.btnStartDay = document.getElementById('btn-start-day');
        this.btnSkipCustomer = document.getElementById('btn-skip-customer');
        this.btnEndDay = document.getElementById('btn-end-day');

        // Modals
        this.filmModal = document.getElementById('film-modal');
        this.shopModal = document.getElementById('shop-modal');
        this.victoryModal = document.getElementById('victory-modal');

        // Film modal
        this.modalCover = document.getElementById('modal-cover');
        this.modalTitleRu = document.getElementById('modal-title-ru');
        this.modalTitleOrig = document.getElementById('modal-title-orig');
        this.modalDescription = document.getElementById('modal-description');
        this.modalGenres = document.getElementById('modal-genres');
        this.modalPrice = document.getElementById('modal-price');
        this.btnOffer = document.getElementById('btn-offer');
        this.btnCloseModal = document.getElementById('btn-close-modal');

        // Shop modal
        this.shopBalanceEl = document.getElementById('shop-balance');
        this.emptySlotsEl = document.getElementById('empty-slots');
        this.filterGenre = document.getElementById('filter-genre');
        this.filterPrice = document.getElementById('filter-price');
        this.shopCatalog = document.getElementById('shop-catalog');
        this.btnCloseShop = document.getElementById('btn-close-shop');

        // Victory
        this.victoryMessage = document.getElementById('victory-message');
        this.btnRestart = document.getElementById('btn-restart');
    }

    bindEvents() {
        this.btnStartDay.addEventListener('click', () => this.startDay());
        this.btnSkipCustomer.addEventListener('click', () => this.nextCustomer());
        this.btnEndDay.addEventListener('click', () => this.endDay());

        this.btnOffer.addEventListener('click', () => this.offerFilm());
        this.btnCloseModal.addEventListener('click', () => this.closeFilmModal());

        this.btnCloseShop.addEventListener('click', () => this.closeShop());
        this.filterGenre.addEventListener('change', () => this.renderShopCatalog());
        this.filterPrice.addEventListener('change', () => this.renderShopCatalog());

        this.btnRestart.addEventListener('click', () => this.restartGame());
    }

    initializeGame() {
        // Fill initial shelf with 10 random films
        const shuffled = [...FILMS].sort(() => Math.random() - 0.5);
        for (let i = 0; i < 10; i++) {
            this.shelf.push(shuffled[i]);
            this.ownedFilms.add(shuffled[i].id);
        }

        this.populateGenreFilter();
        this.renderShelf();
        this.updateStats();
    }

    populateGenreFilter() {
        const genres = new Set();
        FILMS.forEach(film => {
            film.genres.forEach(g => genres.add(g));
        });

        [...genres].sort().forEach(genre => {
            const option = document.createElement('option');
            option.value = genre;
            option.textContent = genre.charAt(0).toUpperCase() + genre.slice(1);
            this.filterGenre.appendChild(option);
        });
    }

    updateStats() {
        this.balanceEl.textContent = this.balance;
        this.soldUniqueEl.textContent = this.soldUnique.size;
        this.soldTotalEl.textContent = this.soldTotal;
        this.dayNumberEl.textContent = this.day;
    }

    renderShelf() {
        this.shelfEl.innerHTML = '';

        for (let i = 0; i < 10; i++) {
            const slot = document.createElement('div');
            slot.className = 'shelf-slot';
            slot.dataset.index = i;

            if (this.shelf[i]) {
                const film = this.shelf[i];
                slot.innerHTML = `
                    <div class="shelf-running-content">
                        <div class="vhs-case">
                            <div class="vhs-spine"></div>
                            <div class="cover-wrapper">
                                <img src="${film.coverUrl}" alt="${film.titleRu}" onerror="this.src='https://placehold.co/200x300/2d1f3d/9d4edd?text=VHS'">
                            </div>
                            <div class="vhs-label">
                                <div class="slot-title">${film.titleRu}</div>
                                <div class="slot-price">${film.price * 2}₽</div>
                            </div>
                        </div>
                    </div>
                `;
                slot.addEventListener('click', () => this.openFilmModal(i));
            } else {
                slot.classList.add('empty');
                slot.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-size:24px;">📼</div>';
            }

            this.shelfEl.appendChild(slot);
        }
    }

    // ==========================================
    // DAY PHASE
    // ==========================================

    startDay() {
        this.isDay = true;
        this.currentCustomerIndex = 0;

        // Generate 5-8 customers for today
        const customerCount = 5 + Math.floor(Math.random() * 4);
        this.todayCustomers = this.generateCustomers(customerCount);

        this.totalCustomersEl.textContent = customerCount;

        this.btnStartDay.style.display = 'none';
        this.btnSkipCustomer.style.display = 'inline-block';
        this.btnEndDay.style.display = 'inline-block';

        this.showCustomer();
    }

    generateCustomers(count) {
        // 1. Identification of films on the shelf
        const shelfFilmIds = this.shelf.filter(f => f !== null).map(f => f.id);

        let chosenRequests = [];
        let usedRequestIndices = new Set();

        // 2. 50% linked to shelf
        const linkedCount = Math.ceil(count / 2);

        // Find requests that link to our shelf films
        const linkedRequests = REQUESTS.filter((req, index) => {
            // Check if this request links to ANY film we have on shelf
            const hasLink = req.linkedFilmIds.some(id => shelfFilmIds.includes(id));
            if (hasLink) return true;
            return false;
        });

        // Add random linked requests
        const shuffledLinked = [...linkedRequests].sort(() => Math.random() - 0.5);

        for (let req of shuffledLinked) {
            if (chosenRequests.length >= linkedCount) break;

            // Find original index to mark as used
            const originalIndex = REQUESTS.indexOf(req);
            if (!usedRequestIndices.has(originalIndex)) {
                chosenRequests.push(req);
                usedRequestIndices.add(originalIndex);
            }
        }

        // 3. Remaining random requests (unique for today)
        const remainingCount = count - chosenRequests.length;
        const allShuffled = [...REQUESTS].map((r, i) => ({ r, i })).sort(() => Math.random() - 0.5);

        for (let { r, i } of allShuffled) {
            if (chosenRequests.length >= count) break;

            if (!usedRequestIndices.has(i)) {
                chosenRequests.push(r);
                usedRequestIndices.add(i);
            }
        }

        // 4. Shuffle the final list and add avatars
        return chosenRequests
            .sort(() => Math.random() - 0.5)
            .map(request => ({
                ...request,
                avatar: CUSTOMER_AVATARS[Math.floor(Math.random() * CUSTOMER_AVATARS.length)]
            }));
    }

    showCustomer() {
        if (this.currentCustomerIndex >= this.todayCustomers.length) {
            this.endDay();
            return;
        }

        const customer = this.todayCustomers[this.currentCustomerIndex];
        this.currentRequest = customer;

        this.customerAvatarEl.textContent = customer.avatar;
        this.customerRequestEl.textContent = `"${customer.text}"`;
        this.currentCustomerEl.textContent = this.currentCustomerIndex + 1;

        // Animation
        this.customerAvatarEl.style.animation = 'none';
        setTimeout(() => {
            this.customerAvatarEl.style.animation = 'float 2s ease-in-out infinite';
        }, 10);
    }

    nextCustomer() {
        this.currentCustomerIndex++;
        this.showCustomer();
    }

    openFilmModal(slotIndex) {
        if (!this.isDay || !this.shelf[slotIndex]) return;

        this.selectedSlot = slotIndex;
        const film = this.shelf[slotIndex];

        this.modalCover.src = film.coverUrl;
        this.modalCover.onerror = () => {
            this.modalCover.src = 'https://placehold.co/150x200/2d1f3d/9d4edd?text=VHS';
        };
        this.modalTitleRu.textContent = film.titleRu;
        this.modalTitleOrig.textContent = film.titleOriginal + ' (' + film.year + ')';
        this.modalDescription.textContent = film.description || '';
        this.modalGenres.textContent = 'Жанры: ' + film.genres.join(', ');
        this.modalPrice.textContent = 'Цена: ' + (film.price * 2) + '₽';

        this.filmModal.classList.remove('hidden');
    }

    closeFilmModal() {
        this.filmModal.classList.add('hidden');
        this.selectedSlot = null;
    }

    offerFilm() {
        if (this.selectedSlot === null || !this.currentRequest) return;

        const film = this.shelf[this.selectedSlot];
        const isMatch = this.currentRequest.linkedFilmIds.includes(film.id);

        this.closeFilmModal();

        if (isMatch) {
            // Success!
            this.handleSale(film, this.selectedSlot);
        } else {
            // Fail
            this.handleRejection();
        }
    }

    handleSale(film, slotIndex) {
        const salePrice = film.price * 2;
        this.balance += salePrice;
        this.soldTotal++;
        this.soldUnique.add(film.id);

        // Remove from shelf
        this.shelf[slotIndex] = null;
        this.ownedFilms.delete(film.id);

        // Feedback
        const panel = document.getElementById('customer-panel');
        panel.classList.add('sale-success');
        setTimeout(() => panel.classList.remove('sale-success'), 500);

        this.customerRequestEl.textContent = `"Отлично! Именно то, что я искал! Держите ${salePrice}₽"`;

        this.updateStats();
        this.renderShelf();

        // Check win condition
        if (this.checkWinCondition()) return;

        // Move to next customer after delay
        setTimeout(() => this.nextCustomer(), 1500);
    }

    handleRejection() {
        const panel = document.getElementById('customer-panel');
        panel.classList.add('sale-fail');
        setTimeout(() => panel.classList.remove('sale-fail'), 500);

        const rejections = [
            "Нет, это не то... Пойду поищу в другом месте.",
            "Хм, не подходит. До свидания!",
            "Это не то, что я искал. Удачи!",
            "Нет, спасибо. Пойду дальше.",
            "Не то, что я хотел. Всего хорошего!"
        ];

        this.customerRequestEl.textContent = `"${rejections[Math.floor(Math.random() * rejections.length)]}"`;

        // Customer leaves after rejection
        setTimeout(() => this.nextCustomer(), 1500);
    }

    endDay() {
        this.isDay = false;
        this.isEvening = true;
        this.currentRequest = null;

        this.customerAvatarEl.textContent = '🌙';
        this.customerRequestEl.textContent = 'Магазин закрыт. Время пополнить запасы!';
        this.currentCustomerEl.textContent = '0';
        this.totalCustomersEl.textContent = '0';

        this.btnSkipCustomer.style.display = 'none';
        this.btnEndDay.style.display = 'none';

        this.openShop();
    }

    // ==========================================
    // EVENING PHASE (SHOP)
    // ==========================================

    openShop() {
        this.shopBalanceEl.textContent = this.balance;
        this.emptySlotsEl.textContent = this.shelf.filter(s => s === null).length;
        this.renderShopCatalog();
        this.shopModal.classList.remove('hidden');
    }

    renderShopCatalog() {
        const genreFilter = this.filterGenre.value;
        const priceFilter = this.filterPrice.value;

        // 1. Filter films
        let films = FILMS.filter(film => !this.ownedFilms.has(film.id));

        // Apply genre filter
        if (genreFilter) {
            films = films.filter(film => film.genres.includes(genreFilter));
        }

        // Apply price filter
        if (priceFilter === 'cheap') {
            films = films.filter(film => film.price <= 100);
        } else if (priceFilter === 'medium') {
            films = films.filter(film => film.price > 100 && film.price <= 300);
        } else if (priceFilter === 'expensive') {
            films = films.filter(film => film.price > 300);
        }

        this.shopCatalog.innerHTML = '';

        // 2. Render items
        if (films.length === 0) {
            this.shopCatalog.innerHTML = '<p style="text-align:center;color:#888;padding:20px;grid-column:1/-1;">Нет доступных фильмов по выбранным фильтрам</p>';
            return;
        }

        films.forEach(film => {
            const item = document.createElement('div');
            item.className = 'shop-item';

            const canAfford = this.balance >= film.price;
            const hasEmptySlot = this.shelf.some(s => s === null);
            const isPurchasable = canAfford && hasEmptySlot;

            if (!isPurchasable) {
                item.classList.add('owned'); // effectively disabled
            }

            // Button HTML
            let buttonHtml = '';
            if (isPurchasable) {
                buttonHtml = `<button class="btn-buy">Купить</button>`;
            } else if (!canAfford) {
                buttonHtml = `<div style="color:var(--neon-pink);font-size:10px;">Не хватает денег</div>`;
            } else {
                buttonHtml = `<div style="color:var(--text-secondary);font-size:10px;">Нет места</div>`;
            }

            item.innerHTML = `
                <div class="shop-vhs-case">
                    <div class="shop-vhs-spine"></div>
                    <div class="shop-cover-wrapper">
                        <img src="${film.coverUrl}" alt="${film.titleRu}" onerror="this.src='https://placehold.co/120x160/2d1f3d/9d4edd?text=VHS'">
                    </div>
                    <div class="shop-vhs-label">
                        <div class="shop-item-title">${film.titleRu}</div>
                        <div class="shop-item-price">${film.price}₽</div>
                    </div>
                </div>
                ${buttonHtml}
            `;

            if (isPurchasable) {
                const btn = item.querySelector('.btn-buy');
                btn.addEventListener('click', (e) => {
                    e.stopPropagation(); // prevent card click if we add one later
                    this.buyFilm(film);
                });
            }

            this.shopCatalog.appendChild(item);
        });
    }

    buyFilm(film) {
        if (this.balance < film.price) return;

        const emptySlotIndex = this.shelf.findIndex(s => s === null);
        if (emptySlotIndex === -1) return;

        this.balance -= film.price;
        this.shelf[emptySlotIndex] = film;
        this.ownedFilms.add(film.id);

        this.shopBalanceEl.textContent = this.balance;
        this.emptySlotsEl.textContent = this.shelf.filter(s => s === null).length;

        this.renderShopCatalog();
        this.renderShelf();
        this.updateStats();
    }

    closeShop() {
        this.shopModal.classList.add('hidden');
        this.isEvening = false;
        this.day++;

        this.btnStartDay.style.display = 'inline-block';
        this.customerAvatarEl.textContent = '☀️';
        this.customerRequestEl.textContent = `День ${this.day}. Нажмите "Начать день" чтобы открыть магазин.`;

        this.updateStats();
    }

    // ==========================================
    // WIN CONDITION
    // ==========================================

    checkWinCondition() {
        if (this.soldUnique.size >= this.UNIQUE_WIN) {
            this.showVictory(`Вы продали ${this.soldUnique.size} разных фильмов!`);
            return true;
        }
        if (this.soldTotal >= this.TOTAL_WIN) {
            this.showVictory(`Вы продали ${this.soldTotal} фильмов!`);
            return true;
        }
        return false;
    }

    showVictory(message) {
        this.victoryMessage.textContent = message + ` Ваш баланс: ${this.balance}₽. Дней: ${this.day}.`;
        this.victoryModal.classList.remove('hidden');
    }

    restartGame() {
        // Reset all state
        this.balance = 500;
        this.day = 1;
        this.soldUnique = new Set();
        this.soldTotal = 0;
        this.shelf = [];
        this.ownedFilms = new Set();
        this.inventory = [];
        this.currentCustomerIndex = 0;
        this.todayCustomers = [];
        this.currentRequest = null;
        this.selectedSlot = null;
        this.isDay = false;
        this.isEvening = false;

        // Reinitialize
        const shuffled = [...FILMS].sort(() => Math.random() - 0.5);
        for (let i = 0; i < 10; i++) {
            this.shelf.push(shuffled[i]);
            this.ownedFilms.add(shuffled[i].id);
        }

        // Hide modals
        this.victoryModal.classList.add('hidden');
        this.filmModal.classList.add('hidden');
        this.shopModal.classList.add('hidden');

        // Reset UI
        this.btnStartDay.style.display = 'inline-block';
        this.btnSkipCustomer.style.display = 'none';
        this.btnEndDay.style.display = 'none';

        this.customerAvatarEl.textContent = '🧑';
        this.customerRequestEl.textContent = 'Нажмите "Начать день" чтобы открыть магазин';
        this.currentCustomerEl.textContent = '0';
        this.totalCustomersEl.textContent = '0';

        this.renderShelf();
        this.updateStats();
    }
}

// ==========================================
// INITIALIZE GAME
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    window.game = new VHSTraderGame();
});
