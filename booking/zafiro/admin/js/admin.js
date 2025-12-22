document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const btnLogout = document.getElementById('btn-logout');

    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.querySelector('.sidebar');

    // Mobile Menu Toggle
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('active') && !sidebar.contains(e.target) && e.target !== menuToggle) {
                sidebar.classList.remove('active');
            }
        });
    }

    // Handle Login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('username').value;
            const pass = document.getElementById('password').value;

            try {
                const userCredential = await auth.signInWithEmailAndPassword(email, pass);
                const user = userCredential.user;

                localStorage.setItem('zafiro_admin', JSON.stringify({
                    uid: user.uid,
                    email: user.email,
                    role: user.email.includes('admin') ? 'admin' : 'owner'
                }));

                window.location.href = 'index.html';
            } catch (error) {
                console.error("Login error:", error);
                alert('Error al iniciar sesión: ' + error.message);
            }
        });
    }

    // Handle Password Reset
    const handleReset = async (email) => {
        if (!email) {
            showToast('Por favor, ingrese su correo electrónico primero.', 'error');
            return;
        }
        try {
            await auth.sendPasswordResetEmail(email);
            showToast('Se ha enviado un correo para restablecer su contraseña.', 'success');
        } catch (error) {
            console.error("Reset error:", error);
            showToast('Error al enviar el correo: ' + error.message, 'error');
        }
    };

    const btnChangeDashboard = document.getElementById('btn-change-password');
    if (btnChangeDashboard) {
        btnChangeDashboard.addEventListener('click', () => {
            const user = auth.currentUser;
            if (user) handleReset(user.email);
        });
    }

    // Handle Logout
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            auth.signOut().then(() => {
                localStorage.removeItem('zafiro_admin');
                window.location.href = 'login.html';
            });
        });
    }

    // Protection check
    auth.onAuthStateChanged((user) => {
        const isIndex = window.location.pathname.includes('index.html');
        if (isIndex && !user) {
            window.location.href = 'login.html';
        } else if (isIndex && user) {
            const adminData = JSON.parse(localStorage.getItem('zafiro_admin')) || { email: user.email };
            initDashboard(user, adminData);
        }
    });
});

function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

function initDashboard(user, adminData) {
    const pageTitle = document.getElementById('page-title');
    const roleBadge = document.getElementById('user-role-badge');
    if (pageTitle) pageTitle.innerText = `Bienvenido, ${user.email.split('@')[0]}`;
    if (roleBadge) roleBadge.innerText = adminData.role === 'admin' ? 'Super Admin' : 'Propietario';

    // Revenue filter initialization
    const revenueFilter = document.getElementById('revenue-status-filter');
    if (revenueFilter) {
        revenueFilter.onchange = () => {
            loadBookings(adminData, revenueFilter.value);
        };
    }

    loadBookings(adminData, revenueFilter ? revenueFilter.value : 'all');
}

function loadBookings(adminData, currentFilter = 'all') {
    const tableBody = document.getElementById('bookings-table-body');
    if (!tableBody) return;

    db.collection('bookings').orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
        tableBody.innerHTML = '';
        let todayCount = 0;
        let monthlyRevenue = 0;
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px;">No hay reservas registradas aún.</td></tr>';
        }

        snapshot.forEach((doc) => {
            const data = doc.data();

            // Map 'pending' to 'Reserva solicitada' for legacy data consistency
            let status = data.status || 'Reserva solicitada';
            if (status === 'pending') status = 'Reserva solicitada';

            const discount = parseFloat(data.discount || 0);
            const baseTotal = parseFloat(data.total || 0);
            const netTotal = baseTotal * (1 - discount);

            if (data.createdAt && data.createdAt.toDate) {
                const createdDate = data.createdAt.toDate();
                if (createdDate >= startOfDay) todayCount++;
                if (createdDate >= startOfMonth) {
                    if (currentFilter === 'all' || status === currentFilter) {
                        monthlyRevenue += netTotal;
                    }
                }
            }

            const row = document.createElement('tr');
            const dateStr = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toLocaleDateString() : 'Hoy';

            let totalHTML = discount > 0
                ? `<div style="display:flex; flex-direction:column;">
                    <span style="text-decoration: line-through; color: var(--admin-text-muted); font-size: 11px;">$${baseTotal.toLocaleString()}</span>
                    <span style="color: var(--admin-accent); font-weight: 700;">$${netTotal.toLocaleString()}</span>
                    <small style="color: #00c853; font-size: 10px;">-${discount * 100}% aplicado</small>
                   </div>`
                : `<strong>$${baseTotal.toLocaleString()}</strong>`;

            let statusClass = "pending";
            if (status === 'Reserva pagada') statusClass = "confirmed";
            if (status === 'Experiencia realizada') statusClass = "complete";

            row.innerHTML = `
                <td>${data.client || 'N/A'}</td>
                <td>${data.service || 'N/A'}</td>
                <td>${dateStr}</td>
                <td>${totalHTML}</td>
                <td><span class="status-badge ${statusClass}">${status}</span></td>
                <td><button class="btn-action" onclick="viewDetails('${doc.id}')">Detalles</button></td>
            `;
            tableBody.appendChild(row);
        });

        // Update Stats ONLY after the loop is done
        if (document.getElementById('stat-bookings-today')) document.getElementById('stat-bookings-today').innerText = todayCount;
        if (document.getElementById('stat-revenue-month')) {
            const revenueStr = monthlyRevenue >= 1000000
                ? `$${(monthlyRevenue / 1000000).toFixed(1)}M`
                : (monthlyRevenue >= 1000 ? `$${(monthlyRevenue / 1000).toFixed(1)}K` : `$${monthlyRevenue.toLocaleString()}`);
            document.getElementById('stat-revenue-month').innerText = revenueStr;
        }
    }, (error) => {
        console.error("Error en Snapshot:", error);
    });
}

const detailsModal = document.getElementById('details-modal');
const closeDetails = document.getElementById('close-details');
const editForm = document.getElementById('edit-booking-form');
const btnDelete = document.getElementById('btn-delete-booking');

function viewDetails(id) {
    db.collection('bookings').doc(id).get().then((doc) => {
        if (doc.exists) {
            const data = doc.data();

            // Map legacy statuses for the modal selector
            let status = data.status || 'Reserva solicitada';
            if (status === 'pending' || status === 'confirmed' || status === 'cancelled') {
                status = 'Reserva solicitada'; // Default legacy to first new status
            }

            document.getElementById('edit-id').value = id;
            document.getElementById('edit-client').value = data.client || '';
            document.getElementById('edit-whatsapp').value = data.whatsapp || '';
            document.getElementById('edit-service').value = data.service || 'Yate Diamante Real';
            document.getElementById('edit-status').value = status;
            document.getElementById('edit-total').value = data.total || 0;
            detailsModal.style.display = 'flex';
        }
    }).catch(error => showToast('Error: ' + error.message, 'error'));
}

if (closeDetails) closeDetails.onclick = () => detailsModal.style.display = 'none';

if (editForm) {
    editForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-id').value;
        const updatedData = {
            client: document.getElementById('edit-client').value,
            whatsapp: document.getElementById('edit-whatsapp').value,
            service: document.getElementById('edit-service').value,
            status: document.getElementById('edit-status').value,
            total: parseFloat(document.getElementById('edit-total').value)
        };
        try {
            await db.collection('bookings').doc(id).update(updatedData);
            showToast('Actualizado', 'success');
            detailsModal.style.display = 'none';
        } catch (error) {
            showToast('Error: ' + error.message, 'error');
        }
    };
}

if (btnDelete) {
    btnDelete.onclick = async () => {
        const id = document.getElementById('edit-id').value;
        if (confirm('¿Eliminar reserva?')) {
            try {
                // IMPORTANT: When deleting, we also notify the UI immediately
                // Firestore onSnapshot will handle the table update.
                await db.collection('bookings').doc(id).delete();
                showToast('Eliminada', 'success');
                detailsModal.style.display = 'none';
            } catch (error) {
                showToast('Error: ' + error.message, 'error');
            }
        }
    };
}

window.onclick = (event) => {
    if (event.target == detailsModal) detailsModal.style.display = 'none';
};
