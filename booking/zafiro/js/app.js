document.addEventListener('DOMContentLoaded', () => {
    // Preloader logic
    const preloader = document.getElementById('preloader');
    if (preloader) {
        setTimeout(() => {
            preloader.classList.add('fade-out');
            setTimeout(() => {
                preloader.style.display = 'none';
            }, 500);
        }, 2000);
    }

    const modal = document.getElementById('booking-modal');
    const successPopup = document.getElementById('success-popup');
    const summaryModal = document.getElementById('summary-modal');
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
    const whatsappFinalBtn = document.getElementById('whatsapp-final-btn');
    const reservationDetailsDiv = document.getElementById('reservation-details');

    let currentService = null;
    let fpDate = null;
    let fpStart = null;
    let fpEnd = null;
    let lastReservationData = null;

    // Load existing reservation
    checkExistingBooking();

    // Open Modal
    reserveBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.card');
            currentService = {
                id: card.dataset.id,
                name: card.dataset.name,
                type: card.dataset.type,
                price: parseFloat(card.dataset.price)
            };

            document.getElementById('modal-title').innerText = `Reservar ${currentService.name}`;
            document.getElementById('modal-desc').innerText = currentService.type === 'full'
                ? 'Alquiler por días completos.'
                : 'Alquiler por horas (máximo 9h).';

            modal.style.display = 'block';
            initPickers();
        });
    });

    // Close Modals
    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => closeAllModals());
    });

    window.onclick = (event) => {
        if (event.target == modal) closeAllModals();
        if (event.target == successPopup) successPopup.style.display = 'none';
        if (event.target == summaryModal) summaryModal.style.display = 'none';
    };

    function closeAllModals() {
        modal.style.display = 'none';
        successPopup.style.display = 'none';
        summaryModal.style.display = 'none';
        resetSteps();
    }

    function initPickers() {
        if (fpDate) fpDate.destroy();
        if (fpStart) fpStart.destroy();
        if (fpEnd) fpEnd.destroy();

        fpDate = flatpickr(calendarInput, {
            locale: 'es',
            minDate: 'today',
            mode: currentService.type === 'full' ? 'range' : 'single',
            onChange: (selectedDates) => {
                if (currentService.type === 'partial' && selectedDates.length > 0) {
                    timeSelection.style.display = 'block';
                    validateAndCalculate();
                } else if (currentService.type === 'full' && selectedDates.length === 2) {
                    validateAndCalculate();
                }
            }
        });

        if (currentService.type === 'partial') {
            const timeConfig = {
                enableTime: true,
                noCalendar: true,
                dateFormat: "H:i",
                time_24hr: true,
                onChange: () => validateAndCalculate()
            };
            fpStart = flatpickr(startTimeInput, timeConfig);
            fpEnd = flatpickr(endTimeInput, timeConfig);
        } else {
            timeSelection.style.display = 'none';
        }
    }

    function validateAndCalculate() {
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

    reservationForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(reservationForm);
        const reservation = {
            ...lastReservationData,
            client: formData.get('name') || document.getElementById('name').value,
            whatsapp: formData.get('whatsapp') || document.getElementById('whatsapp').value
        };
        localStorage.setItem('zafiro_booking', JSON.stringify(reservation));
        modal.style.display = 'none';
        successPopup.style.display = 'block';
    });

    whatsappBtn.addEventListener('click', (e) => {
        e.preventDefault();
        successPopup.style.display = 'none';
        checkExistingBooking();
    });

    bookingBadge.addEventListener('click', () => {
        const data = JSON.parse(localStorage.getItem('zafiro_booking'));
        if (data) {
            reservationDetailsDiv.innerHTML = `
                <p><strong>Servicio:</strong> ${data.service}</p>
                <p><strong>Costo:</strong> $${data.total.toLocaleString()}</p>
                <p><strong>Detalle:</strong> ${data.type === 'full'
                    ? data.dates.map(d => new Date(d).toLocaleDateString()).join(' - ')
                    : `${new Date(data.date).toLocaleDateString()} de ${data.startTime} a ${data.endTime}`}</p>
            `;
            const msg = encodeURIComponent(`Hola Zafiro Marine, tengo una reserva para ${data.service}. Mi nombre es ${data.client}.`);
            whatsappFinalBtn.href = `https://wa.me/573000000000?text=${msg}`;
            summaryModal.style.display = 'block';
        }
    });

    function checkExistingBooking() {
        const data = localStorage.getItem('zafiro_booking');
        if (data) {
            bookingBadge.style.display = 'flex';
        }
    }

    function resetSteps() {
        stepDate.style.display = 'block';
        stepForm.style.display = 'none';
        priceSummary.style.display = 'none';
        timeSelection.style.display = 'none';
        btnNext.disabled = false;
        reservationForm.reset();
        if (fpDate) fpDate.clear();
        if (fpStart) fpStart.clear();
        if (fpEnd) fpEnd.clear();
    }
});
