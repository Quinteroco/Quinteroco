document.addEventListener('DOMContentLoaded', () => {
    // Preloader logic
    const preloader = document.getElementById('preloader');
    if (preloader) {
        setTimeout(() => {
            preloader.classList.add('fade-out');
            setTimeout(() => {
                preloader.style.display = 'none';
            }, 500);
        }, 1000); // Reduced to 1 second
    }

    const modal = document.getElementById('booking-modal');
    const successPopup = document.getElementById('success-popup');
    const summaryModal = document.getElementById('summary-modal');
    const rouletteModal = document.getElementById('roulette-modal');
    const bookingBadge = document.getElementById('booking-badge');

    const closeBtns = document.querySelectorAll('.close-modal');
    const reserveBtns = document.querySelectorAll('.btn-reserve');
    const calendarInput = document.getElementById('calendar-input');
    const startTimeInput = document.getElementById('start-time');
    const endTimeInput = document.getElementById('end-time');
    const btnNext = document.getElementById('btn-next');
    const reservationForm = document.getElementById('reservation-form');
    const priceSummary = document.getElementById('price-summary');
    const totalPriceSpan = document.getElementById('total-price');
    const summaryDetails = document.getElementById('summary-details');
    const stepDate = document.getElementById('step-date');
    const stepForm = document.getElementById('step-form');
    const timeSelection = document.getElementById('time-selection');

    const whatsappBtn = document.querySelector('.btn-cta');
    const btnShowRoulette = document.getElementById('btn-show-roulette');
    const btnSpin = document.getElementById('btn-spin');
    const btnClaim = document.getElementById('btn-claim');
    const wheel = document.getElementById('roulette-wheel');
    const rouletteResult = document.getElementById('roulette-result');

    const whatsappFinalBtn = document.getElementById('whatsapp-final-btn');
    const reservationDetailsDiv = document.getElementById('reservation-details');

    // Gallery Elements
    const galleryModal = document.getElementById('gallery-modal');
    const galleryContainer = document.getElementById('gallery-images-container');
    const btnGalleryPrev = document.getElementById('btn-gallery-prev');
    const btnGalleryNext = document.getElementById('btn-gallery-next');
    const currentImgSpan = document.getElementById('current-img');
    const totalImgsSpan = document.getElementById('total-imgs');
    let currentGalleryImages = [];
    let currentGalleryIndex = 0;

    let currentService = null;
    let fpDate = null;
    let fpStart = null;
    let fpEnd = null;
    let lastReservationData = null;

    // Load existing reservation
    checkExistingBooking();

    // Dynamic Service Loading
    function renderServices() {
        const grid = document.getElementById('services-grid');
        if (!grid) return;

        db.collection('services').where('status', '==', 'activo').onSnapshot((snapshot) => {
            grid.innerHTML = '';
            if (snapshot.empty) {
                grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No hay experiencias disponibles en este momento.</p>';
                return;
            }

            snapshot.forEach((doc) => {
                const data = doc.data();
                const priceUnit = data.type === 'full' ? 'día' : 'hora';
                const images = data.images || [data.image || './img/yate1.png'];

                const card = document.createElement('div');
                card.className = 'card';
                card.dataset.id = doc.id;
                card.dataset.name = data.name;
                card.dataset.type = data.type;
                card.dataset.price = data.price;

                // Store availability and all images in dataset for modal access
                card.dataset.images = JSON.stringify(images);
                if (data.availability) {
                    card.dataset.availability = JSON.stringify(data.availability);
                }

                // Render gallery dots if multiple images
                const galleryDots = images.length > 1 ? `<div class="gallery-dots">${images.map((_, i) => `<span class="${i === 0 ? 'active' : ''}"></span>`).join('')}</div>` : '';

                card.innerHTML = `
                    <div class="card-img" style="background-image: url('${images[0]}');">
                        ${galleryDots}
                    </div>
                    <div class="card-body">
                        <h3>${data.name}</h3>
                        <p>${data.description || ''}</p>
                        <div class="price">Desde $${parseFloat(data.price).toLocaleString()} / ${priceUnit}</div>
                        <button class="btn-reserve">Reservar Ahora</button>
                    </div>
                `;
                grid.appendChild(card);
            });
        });
    }

    renderServices();

    // Open Modal (Event Delegation)
    const servicesGrid = document.getElementById('services-grid');
    if (servicesGrid) {
        servicesGrid.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-reserve')) {
                // Check if there is an active booking first
                if (localStorage.getItem('zafiro_booking')) {
                    showReservationSummary();
                    return;
                }

                const card = e.target.closest('.card');
                currentService = {
                    id: card.dataset.id,
                    name: card.dataset.name,
                    type: card.dataset.type,
                    price: parseFloat(card.dataset.price),
                    availability: card.dataset.availability ? JSON.parse(card.dataset.availability) : null,
                    images: JSON.parse(card.dataset.images || '[]')
                };

                document.getElementById('modal-title').innerText = `Reservar ${currentService.name}`;
                document.getElementById('modal-desc').innerText = currentService.type === 'full'
                    ? 'Alquiler por días completos.'
                    : 'Alquiler por horas (máximo 9h).';

                modal.style.display = 'block';
                initPickers();
            }

            // Click on Image to open gallery
            if (e.target.classList.contains('card-img')) {
                const card = e.target.closest('.card');
                const images = JSON.parse(card.dataset.images || '[]');
                if (images.length > 0) {
                    openGallery(images);
                }
            }
        });
    }

    // Gallery Logic
    function openGallery(images) {
        currentGalleryImages = images;
        currentGalleryIndex = 0;
        renderGallery();
        galleryModal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Lock scroll
    }

    function renderGallery() {
        galleryContainer.innerHTML = '';
        currentGalleryImages.forEach(src => {
            const div = document.createElement('div');
            div.className = 'gallery-image';
            div.innerHTML = `<img src="${src}" alt="Gallery image">`;
            galleryContainer.appendChild(div);
        });
        updateGalleryUI();
    }

    function updateGalleryUI() {
        const offset = -currentGalleryIndex * 100;
        galleryContainer.style.transform = `translateX(${offset}%)`;
        currentImgSpan.innerText = currentGalleryIndex + 1;
        totalImgsSpan.innerText = currentGalleryImages.length;

        // Hide nav if only one image
        btnGalleryPrev.style.display = currentGalleryImages.length > 1 ? 'block' : 'none';
        btnGalleryNext.style.display = currentGalleryImages.length > 1 ? 'block' : 'none';
    }

    function nextImg() {
        currentGalleryIndex = (currentGalleryIndex + 1) % currentGalleryImages.length;
        updateGalleryUI();
    }

    function prevImg() {
        currentGalleryIndex = (currentGalleryIndex - 1 + currentGalleryImages.length) % currentGalleryImages.length;
        updateGalleryUI();
    }

    btnGalleryNext.onclick = nextImg;
    btnGalleryPrev.onclick = prevImg;

    document.querySelector('.close-gallery').onclick = () => {
        galleryModal.style.display = 'none';
        document.body.style.overflow = ''; // Unlock scroll
    };

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (galleryModal.style.display === 'flex') {
            if (e.key === 'ArrowRight') nextImg();
            if (e.key === 'ArrowLeft') prevImg();
            if (e.key === 'Escape') {
                galleryModal.style.display = 'none';
                document.body.style.overflow = '';
            }
        }
    });

    // Close Modals
    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => closeAllModals());
    });

    window.onclick = (event) => {
        if (event.target == modal) closeAllModals();
        if (event.target == successPopup) successPopup.style.display = 'none';
        if (event.target == summaryModal) summaryModal.style.display = 'none';
        if (event.target == rouletteModal) rouletteModal.style.display = 'none';
    };

    function closeAllModals() {
        modal.style.display = 'none';
        successPopup.style.display = 'none';
        summaryModal.style.display = 'none';
        rouletteModal.style.display = 'none';
        resetSteps();
    }

    function initPickers() {
        if (fpDate) fpDate.destroy();
        if (fpStart) fpStart.destroy();
        if (fpEnd) fpEnd.destroy();

        const minTime = currentService.availability ? currentService.availability.startTime : "00:00";
        const maxTime = currentService.availability ? currentService.availability.endTime : "23:59";

        fpDate = flatpickr(calendarInput, {
            locale: 'es',
            minDate: 'today',
            mode: currentService.type === 'full' ? 'range' : 'single',
            onChange: (selectedDates) => {
                if (currentService.type === 'partial' && selectedDates.length > 0) {
                    timeSelection.style.display = 'block';
                    validateAndCalculate();
                } else if (currentService.type === 'full' && selectedDates.length === 2) {
                    updateSummary();
                }
            }
        });

        if (currentService.type === 'partial') {
            fpStart = flatpickr(startTimeInput, {
                enableTime: true,
                noCalendar: true,
                dateFormat: "H:i",
                time_24hr: true,
                minTime: minTime,
                maxTime: maxTime,
                onChange: () => updateSummary()
            });

            fpEnd = flatpickr(endTimeInput, {
                enableTime: true,
                noCalendar: true,
                dateFormat: "H:i",
                time_24hr: true,
                minTime: minTime,
                maxTime: maxTime,
                onChange: () => updateSummary()
            });
        } else {
            timeSelection.style.display = 'none';
        }
    }

    function updateSummary() {
        let total = 0;
        let valid = false;
        let details = "";

        if (currentService.type === 'full') {
            const dates = fpDate.selectedDates;
            if (dates.length === 2) {
                const diffTime = Math.abs(dates[1] - dates[0]);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
                total = diffDays * currentService.price;
                details = `${diffDays} día(s) seleccionado(s)`;
                valid = true;
                lastReservationData = { type: 'full', service: currentService.name, dates: fpDate.selectedDates, total };
            }
        } else {
            const date = fpDate.selectedDates[0];
            const startStr = startTimeInput.value;
            const endStr = endTimeInput.value;

            if (date && startStr && endStr) {
                const start = fpStart.selectedDates[0];
                const end = fpEnd.selectedDates[0];

                if (start && end) {
                    let diffMs = end - start;
                    const diffHours = diffMs / (1000 * 60 * 60);

                    if (diffHours > 9 || diffHours <= 0) {
                        summaryDetails.innerText = diffHours > 9 ? "⚠️ Máximo 9h." : "⚠️ Hora fin inválida.";
                        summaryDetails.style.color = "#cc0000";
                        priceSummary.style.display = 'block';
                        btnNext.disabled = true;
                        return;
                    } else {
                        total = Math.ceil(diffHours) * currentService.price;
                        details = `${Math.ceil(diffHours)} hora(s) seleccionada(s)`;
                        valid = true;
                        btnNext.disabled = false;
                        summaryDetails.style.color = "inherit";
                        lastReservationData = { type: 'partial', service: currentService.name, date, startTime: startStr, endTime: endStr, total };
                    }
                }
            }
        }

        if (valid) {
            totalPriceSpan.innerText = `$${total.toLocaleString()}`;
            summaryDetails.innerText = details;
            priceSummary.style.display = 'block';
        }
    }

    btnNext.addEventListener('click', () => {
        stepDate.style.display = 'none';
        stepForm.style.display = 'block';
    });

    reservationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(reservationForm);
        const reservation = {
            ...lastReservationData,
            client: formData.get('name') || document.getElementById('name').value,
            whatsapp: formData.get('whatsapp') || document.getElementById('whatsapp').value,
            discount: 0,
            status: 'Reserva solicitada',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            // Save to Firebase
            const docRef = await db.collection('bookings').add(reservation);
            reservation.id = docRef.id;

            // Save local copy
            localStorage.setItem('zafiro_booking', JSON.stringify(reservation));

            modal.style.display = 'none';
            successPopup.style.display = 'block';
        } catch (error) {
            console.error("Error saving booking:", error);
            alert("Hubo un error al procesar tu reserva. Por favor intenta de nuevo.");
        }
    });

    // Roulette Logic
    btnShowRoulette.addEventListener('click', () => {
        successPopup.style.display = 'none';
        rouletteModal.style.display = 'block';
        wheel.style.transform = 'rotate(0deg)';
        rouletteResult.style.display = 'none';
        btnSpin.style.display = 'inline-block';
    });

    btnSpin.addEventListener('click', () => {
        btnSpin.disabled = true;
        // Segment 2 is our highlight (10%) and it's at 45deg in CSS.
        // To bring 45deg to the top (0deg), we rotate the wheel by -45deg.
        const rotations = 8;
        const targetAngle = (rotations * 360) - 45;

        wheel.style.transform = `rotate(${targetAngle}deg)`;

        setTimeout(() => {
            rouletteResult.style.display = 'block';
            btnSpin.style.display = 'none';
        }, 4000);
    });

    btnClaim.addEventListener('click', async () => {
        const data = JSON.parse(localStorage.getItem('zafiro_booking'));
        if (data) {
            data.discount = 0.10;

            try {
                if (data.id) {
                    await db.collection('bookings').doc(data.id).update({ discount: 0.10 });
                }
                localStorage.setItem('zafiro_booking', JSON.stringify(data));
            } catch (error) {
                console.error("Error updating discount:", error);
            }
        }
        rouletteModal.style.display = 'none';
        checkExistingBooking();
        showReservationSummary();
    });

    whatsappBtn.addEventListener('click', (e) => {
        e.preventDefault();
        successPopup.style.display = 'none';
        checkExistingBooking();
    });

    bookingBadge.addEventListener('click', () => {
        showReservationSummary();
    });

    function showReservationSummary() {
        const data = JSON.parse(localStorage.getItem('zafiro_booking'));
        if (data) {
            const discountAmount = data.total * (data.discount || 0);
            const finalTotal = data.total - discountAmount;

            reservationDetailsDiv.innerHTML = `
                <p><strong>Servicio:</strong> ${data.service}</p>
                <p><strong>Subtotal:</strong> $${data.total.toLocaleString()}</p>
                ${data.discount ? `<p><strong>Descuento (10%):</strong> -$${discountAmount.toLocaleString()}</p>` : ''}
                <p><strong>Total Final:</strong> $${finalTotal.toLocaleString()}</p>
                <p><strong>Detalle:</strong> ${data.type === 'full'
                    ? data.dates.map(d => new Date(d).toLocaleDateString()).join(' - ')
                    : `${new Date(data.date).toLocaleDateString()} de ${data.startTime} a ${data.endTime}`}</p>
            `;
            const msg = encodeURIComponent(`Hola Zafiro Marine, tengo una reserva para ${data.service} con un descuento del 10%. Mi nombre es ${data.client}.`);
            whatsappFinalBtn.href = `https://wa.me/573000000000?text=${msg}`;
            summaryModal.style.display = 'block';
        }
    }

    async function checkExistingBooking() {
        const rawData = localStorage.getItem('zafiro_booking');

        if (!rawData) {
            if (bookingBadge) bookingBadge.style.display = 'none';
            return;
        }

        try {
            const data = JSON.parse(rawData);

            if (!data || !data.id) {
                console.warn("Zafiro Sync: Datos corruptos o sin ID. Limpiando...");
                localStorage.removeItem('zafiro_booking');
                if (bookingBadge) bookingBadge.style.display = 'none';
                return;
            }

            // Mostramos mientras validamos para respuesta instantánea
            if (bookingBadge) bookingBadge.style.display = 'flex';

            console.log("Zafiro Sync: Validando reserva " + data.id + " con el servidor...");

            try {
                const doc = await db.collection('bookings').doc(data.id).get({ source: 'server' });

                if (!doc.exists) {
                    console.log("Zafiro Sync: La reserva ya no existe en la nube. Borrando local...");
                    localStorage.removeItem('zafiro_booking');
                    if (bookingBadge) bookingBadge.style.display = 'none';
                } else {
                    console.log("Zafiro Sync: Reserva válida confirmada.");
                }
            } catch (innerError) {
                // Si el error es de permisos, es muy probable que la regla de Firebase esté bloqueando 
                // o que el documento haya sido borrado y la regla de seguridad falle al intentar leerlo.
                if (innerError.code === 'permission-denied') {
                    console.warn("Zafiro Sync: Error de permisos. Esto sucede si no tienes reglas de 'read' abiertas o si la reserva fue borrada.");
                    // En este caso, por seguridad y para evitar "fantasmas", limpiamos igual.
                    localStorage.removeItem('zafiro_booking');
                    if (bookingBadge) bookingBadge.style.display = 'none';
                } else {
                    throw innerError; // Pasar al catch exterior para errores de red, etc.
                }
            }
        } catch (error) {
            console.error("Zafiro Sync: Error crítico en validación:", error);
            // Si es un error de red (offline), no borramos para no arruinar la experiencia del usuario.
        }
    }

    checkExistingBooking();
    setInterval(checkExistingBooking, 30000);

    function resetSteps() {
        stepDate.style.display = 'block';
        stepForm.style.display = 'none';
        priceSummary.style.display = 'none';
        timeSelection.style.display = 'none';
        btnNext.disabled = false;
        btnSpin.disabled = false;
        reservationForm.reset();
        if (fpDate) fpDate.clear();
        if (fpStart) fpStart.clear();
        if (fpEnd) fpEnd.clear();
    }
});
