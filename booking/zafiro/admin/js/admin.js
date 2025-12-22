const MASTER_ADMIN = "quintero.orlandoc@gmail.com";
let currentUserPermissions = null;

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

    // Global navigation access
    window.showView = function (viewId, activeLinkId = null) {
        // Toggle views
        document.querySelectorAll('.admin-view').forEach(v => {
            v.style.display = 'none';
            v.classList.remove('active');
        });

        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.style.display = 'block';
            targetView.classList.add('active');
        }

        // Toggle sidebar links
        document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
        if (activeLinkId) {
            const link = document.getElementById(activeLinkId);
            if (link) link.parentElement.classList.add('active');
        }

        // Close sidebar on mobile
        if (sidebar && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
        }
    };

    // SPA Navigation Logic
    const navLinks = {
        'nav-dashboard': 'view-dashboard',
        'nav-services': 'view-services',
        'nav-bookings': 'view-dashboard',
        'nav-admins': 'view-admins'
    };

    Object.keys(navLinks).forEach(id => {
        const link = document.getElementById(id);
        if (link) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                showView(navLinks[id], id);
            });
        }
    });

    // Protection check
    auth.onAuthStateChanged((user) => {
        // Broaden path matching for GitHub Pages and other environments
        const path = window.location.pathname;
        const isAdminPage = path.includes('admin/index.html') || path.endsWith('admin/') || path.endsWith('admin');

        if (isAdminPage && !user) {
            window.location.href = 'login.html';
        } else if (isAdminPage && user) {
            const adminData = JSON.parse(localStorage.getItem('zafiro_admin')) || { email: user.email };

            // Sync current user to 'admins' collection and get permissions
            syncCurrentUser(user);

            initDashboard(user, adminData);
            loadServices();
            initCloudinaryWidget();

            // Case-insensitive check for Master Admin
            if (user.email.toLowerCase() === MASTER_ADMIN.toLowerCase()) {
                console.log("Zafiro Admin: Master Admin detected.");
                loadAdmins();
                const adminNav = document.getElementById('nav-admins-container');
                if (adminNav) {
                    adminNav.style.display = 'block';
                    adminNav.style.opacity = '1';
                    adminNav.style.visibility = 'visible';
                }
            } else {
                console.log("Zafiro Admin: Standard Admin detected (" + user.email + ")");
            }
        }
    });
});

async function syncCurrentUser(user) {
    // 1. Try to find by UID (the standard way)
    let adminDoc = await db.collection('admins').doc(user.uid).get();

    // 2. If not found by UID, check if they were pre-registered by Email
    if (!adminDoc.exists) {
        const emailSnapshot = await db.collection('admins').where('email', '==', user.email).get();
        if (!emailSnapshot.empty) {
            const manualDoc = emailSnapshot.docs[0];
            const manualData = manualDoc.data();

            // Link this UID to the pre-registered data and move it to the UID-based document
            await db.collection('admins').doc(user.uid).set({
                ...manualData,
                uid: user.uid,
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Delete the old email-indexed or auto-ID document to keep it clean
            await db.collection('admins').doc(manualDoc.id).delete();

            // Refresh reference
            adminDoc = await db.collection('admins').doc(user.uid).get();
        }
    }

    if (!adminDoc.exists) {
        // Create initial doc for new admin (Total mystery user)
        const initialData = {
            email: user.email,
            uid: user.uid,
            permissions: {
                manageExperiences: false,
                editStatus: false,
                deleteBookings: false
            },
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        };
        // Master gets everything
        if (user.email === MASTER_ADMIN) {
            initialData.permissions = {
                manageExperiences: true,
                editStatus: true,
                deleteBookings: true
            };
        }
        await db.collection('admins').doc(user.uid).set(initialData);
        currentUserPermissions = initialData.permissions;
    } else {
        await db.collection('admins').doc(user.uid).update({
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
        currentUserPermissions = adminDoc.data().permissions;
    }
    applyPermissionsUI();
}

function applyPermissionsUI() {
    if (!currentUserPermissions || !auth.currentUser) return;

    const isMaster = auth.currentUser.email.toLowerCase() === MASTER_ADMIN.toLowerCase();

    // Hide/Show based on permissions
    const btnNewExp = document.querySelector('[onclick="openExperienceModal()"]');
    if (btnNewExp && !currentUserPermissions.manageExperiences && !isMaster) {
        btnNewExp.style.display = 'none';
    }

    // Ensure the admins tab is visible for master even if this runs late
    const adminNav = document.getElementById('nav-admins-container');
    if (adminNav && isMaster) {
        adminNav.style.display = 'block';
    }
}

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

    // Make stats interactive (clickable shortcut)
    const servicesCard = document.getElementById('stat-active-services')?.closest('.stat-card');
    if (servicesCard) {
        servicesCard.style.cursor = 'pointer';
        servicesCard.onclick = () => showView('view-services', 'nav-services');
    }

    loadBookings(adminData, revenueFilter ? revenueFilter.value : 'all');
}

// BOOKINGS LOGIC
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

            row.innerHTML = `
                <td>${data.client || 'N/A'}</td>
                <td>${data.service || 'N/A'}</td>
                <td>${dateStr}</td>
                <td>${totalHTML}</td>
                <td><span class="status-badge ${getStatusClass(status)}">${status}</span></td>
                <td><button class="btn-action" onclick="viewDetails('${doc.id}')">Detalles</button></td>
            `;
            tableBody.appendChild(row);
        });

        if (document.getElementById('stat-bookings-today')) document.getElementById('stat-bookings-today').innerText = todayCount;
        if (document.getElementById('stat-revenue-month')) {
            const revenueStr = monthlyRevenue >= 1000000
                ? `$${(monthlyRevenue / 1000000).toFixed(1)}M`
                : (monthlyRevenue >= 1000 ? `$${(monthlyRevenue / 1000).toFixed(1)}K` : `$${monthlyRevenue.toLocaleString()}`);
            document.getElementById('stat-revenue-month').innerText = revenueStr;
        }
        applyPermissionsUI();
    });
}

// EXPERIENCES LOGIC
window.toggleScheduleFields = function (type) {
    const scheduleDiv = document.getElementById('partial-schedule');
    if (scheduleDiv) {
        scheduleDiv.style.display = type === 'partial' ? 'block' : 'none';
    }
}

// Cloudinary Logic
let uploadedImages = [];

function initCloudinaryWidget() {
    const btnUpload = document.getElementById('upload-widget');
    if (!btnUpload) return;

    const myWidget = cloudinary.createUploadWidget({
        cloudName: 'dkp9hwxgs',
        uploadPreset: 'zafiro_preset', // USER MUST STILL UPDATE THIS OR CREATE ONE WITH THIS NAME
        multiple: true,
        sources: ['local', 'url'],
        styles: {
            palette: {
                window: '#000000',
                windowBorder: '#d4af37',
                tabIcon: '#d4af37',
                menuIcons: '#d4af37',
                textDark: '#000000',
                textLight: '#FFFFFF',
                link: '#d4af37',
                action: '#d4af37',
                inactiveTabIcon: '#E4E4E4',
                error: '#F44235',
                inProgress: '#d4af37',
                complete: '#20B832',
                sourceBg: '#000000'
            }
        }
    }, (error, result) => {
        if (error) {
            console.error("Cloudinary Error:", error);
            showToast('Error de Cloudinary: Configuración inválida o falla de red', 'error');
            return;
        }

        if (result && result.event === "success") {
            uploadedImages.push(result.info.secure_url);
            renderImagePreviews();
            showToast('Imagen subida correctamente', 'success');
        }
    });

    btnUpload.addEventListener('click', () => myWidget.open(), false);
}

function renderImagePreviews() {
    const gallery = document.getElementById('image-preview-gallery');
    const inputHidden = document.getElementById('exp-images-json');
    if (!gallery) return;

    gallery.innerHTML = '';
    uploadedImages.forEach((url, index) => {
        const div = document.createElement('div');
        div.style.position = 'relative';
        div.style.width = '80px';
        div.style.height = '80px';

        div.innerHTML = `
            <img src="${url}" style="width:100%; height:100%; object-fit:cover; border-radius:4px; border:1px solid rgba(212,175,55,0.3);">
            <button type="button" onclick="removeImage(${index})" style="position:absolute; top:-5px; right:-5px; background:red; color:white; border:none; border-radius:50%; width:18px; height:18px; cursor:pointer; font-size:10px; display:flex; align-items:center; justify-content:center;">×</button>
        `;
        gallery.appendChild(div);
    });

    inputHidden.value = JSON.stringify(uploadedImages);
}

window.removeImage = function (index) {
    uploadedImages.splice(index, 1);
    renderImagePreviews();
}

function getStatusClass(status) {
    if (status === 'Reserva pagada') return "confirmed";
    if (status === 'Experiencia realizada') return "complete";
    if (status === 'activo') return "confirmed";
    if (status === 'inactivo') return "pending";
    return "pending";
}

// EXPERIENCES LOGIC
function loadServices() {
    const tableBody = document.getElementById('services-table-body');
    const statElement = document.getElementById('stat-active-services');
    if (!tableBody) return;

    db.collection('services').onSnapshot((snapshot) => {
        console.log(`Zafiro Admin: Sincronizando experiencias(${snapshot.size} detectadas)`);
        tableBody.innerHTML = '';

        // Update stat count
        if (statElement) {
            statElement.innerText = snapshot.size;
        }

        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--admin-text-muted);">No hay experiencias aún.</td></tr>';
            return;
        }

        snapshot.forEach((doc) => {
            const data = doc.data();
            const row = document.createElement('tr');

            // Defensive data check
            const name = data.name || 'Sin nombre';
            const price = data.price ? parseFloat(data.price).toLocaleString() : '0';
            const type = data.type || 'N/A';
            const status = data.status || 'activo';

            row.innerHTML = `
                <td><strong>${name}</strong></td>
                <td><span class="badge" style="background:rgba(255,255,255,0.05)!important; color:white!important;">${type}</span></td>
                <td>$${price}</td>
                <td><span class="status-badge ${getStatusClass(status)}">${status}</span></td>
                <td>${(currentUserPermissions?.manageExperiences || auth.currentUser?.email === MASTER_ADMIN)
                    ? `<button class="btn-action" onclick="editExperience('${doc.id}')">Editar</button>`
                    : '<small>Sólo Lectura</small>'}</td>
            `;
            tableBody.appendChild(row);
        });
        applyPermissionsUI();
    }, (error) => {
        console.error("Zafiro Error services:", error);
    });
}

const experienceModal = document.getElementById('experience-modal');
const expForm = document.getElementById('experience-form');

function openExperienceModal() {
    expForm.reset();
    document.getElementById('experience-id').value = '';
    document.getElementById('btn-delete-experience').style.display = 'none';
    uploadedImages = [];
    renderImagePreviews();
    toggleScheduleFields('full');
    experienceModal.style.display = 'flex';
}

function editExperience(id) {
    db.collection('services').doc(id).get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('experience-id').value = id;
            document.getElementById('exp-name').value = data.name;
            document.getElementById('exp-type').value = data.type;
            document.getElementById('exp-price').value = data.price;
            document.getElementById('exp-status').value = data.status || 'activo';
            document.getElementById('exp-desc').value = data.description || '';

            // Availability
            if (data.type === 'partial' && data.availability) {
                document.getElementById('exp-start-time').value = data.availability.startTime || '08:00';
                document.getElementById('exp-end-time').value = data.availability.endTime || '17:00';
            }
            toggleScheduleFields(data.type);

            // Images
            uploadedImages = data.images || (data.image ? [data.image] : []);
            renderImagePreviews();

            document.getElementById('btn-delete-experience').style.display = 'inline-block';
            experienceModal.style.display = 'flex';
        }
    });
}

if (expForm) {
    expForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('experience-id').value;
        const type = document.getElementById('exp-type').value;
        const priceValue = document.getElementById('exp-price').value;

        // Validation
        if (!priceValue || isNaN(parseFloat(priceValue))) {
            showToast('Por favor ingresa un precio válido', 'error');
            return;
        }

        const data = {
            name: document.getElementById('exp-name').value,
            type: type,
            price: parseFloat(priceValue),
            status: document.getElementById('exp-status').value,
            images: uploadedImages,
            image: uploadedImages.length > 0 ? uploadedImages[0] : '', // Keep .image for legacy compat
            description: document.getElementById('exp-desc').value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (type === 'partial') {
            data.availability = {
                startTime: document.getElementById('exp-start-time').value,
                endTime: document.getElementById('exp-end-time').value
            };
        }

        try {
            if (id) {
                await db.collection('services').doc(id).update(data);
                showToast('Experiencia actualizada con éxito', 'success');
            } else {
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection('services').add(data);
                showToast('Experiencia creada con éxito', 'success');
            }
            experienceModal.style.display = 'none';
        } catch (error) {
            console.error("Zafiro Error al guardar experiencia:", error);
            showToast('Error al guardar en el servidor: ' + error.message, 'error');
        }
    };
}

document.getElementById('btn-delete-experience').onclick = async () => {
    const id = document.getElementById('experience-id').value;
    if (id && confirm('¿Estás seguro de eliminar esta experiencia?')) {
        try {
            await db.collection('services').doc(id).delete();
            showToast('Experiencia eliminada', 'success');
            experienceModal.style.display = 'none';
        } catch (error) {
            showToast('Error: ' + error.message, 'error');
        }
    }
};

document.getElementById('close-experience-modal').onclick = () => experienceModal.style.display = 'none';

// Modals generic close
const detailsModal = document.getElementById('details-modal');
const closeDetails = document.getElementById('close-details');

function viewDetails(id) {
    db.collection('bookings').doc(id).get().then((doc) => {
        if (doc.exists) {
            const data = doc.data();
            let status = data.status || 'Reserva solicitada';
            if (status === 'pending' || status === 'confirmed' || status === 'cancelled') status = 'Reserva solicitada';

            document.getElementById('edit-id').value = id;
            document.getElementById('edit-client').value = data.client || '';
            document.getElementById('edit-whatsapp').value = data.whatsapp || '';
            document.getElementById('edit-service').value = data.service || 'Yate Diamante Real';
            document.getElementById('edit-status').value = status;
            document.getElementById('edit-total').value = data.total || 0;
            document.getElementById('edit-discount').value = (data.discount || 0) * 100;

            // Permissions for deleting bookings
            const btnDel = document.getElementById('btn-delete-booking');
            if (btnDel) {
                btnDel.style.display = (currentUserPermissions?.deleteBookings || auth.currentUser.email === MASTER_ADMIN)
                    ? 'inline-block' : 'none';
            }

            // Permissions for editing status/info
            const btnSave = detailsModal.querySelector('button[type="submit"]');
            if (btnSave) {
                btnSave.style.display = (currentUserPermissions?.editStatus || auth.currentUser.email === MASTER_ADMIN)
                    ? 'inline-block' : 'none';
            }

            detailsModal.style.display = 'flex';
        }
    });
}

if (closeDetails) closeDetails.onclick = () => detailsModal.style.display = 'none';

// ADMINS MANAGEMENT
function loadAdmins() {
    const tableBody = document.getElementById('admins-table-body');
    if (!tableBody) return;

    db.collection('admins').onSnapshot((snapshot) => {
        tableBody.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            const row = document.createElement('tr');
            const perms = [];
            if (data.permissions?.manageExperiences) perms.push('Exp');
            if (data.permissions?.editStatus) perms.push('Status');
            if (data.permissions?.deleteBookings) perms.push('Del');

            const dateStr = data.lastLogin && data.lastLogin.toDate ? data.lastLogin.toDate().toLocaleString() : 'Nunca';

            row.innerHTML = `
                < td > ${data.email}</td >
                <td>${perms.length > 0 ? perms.join(', ') : '<small>Sin permisos</small>'}</td>
                <td>${dateStr}</td>
                <td>
                    ${data.email === MASTER_ADMIN
                    ? '<span class="badge" style="background:var(--admin-accent)!important;">Master</span>'
                    : `
                            <button class="btn-action" onclick="openPermissionsModal('${doc.id}')">Permisos</button>
                            <button class="btn-action" style="background:rgba(255,0,0,0.1); color:#ff5252;" onclick="removeAdmin('${doc.id}', '${data.email}')">Eliminar</button>
                          `}
                </td>
            `;
            tableBody.appendChild(row);
        });
    });
}

const permissionsModal = document.getElementById('permissions-modal');
const permissionsForm = document.getElementById('permissions-form');

window.openPermissionsModal = function (id) {
    db.collection('admins').doc(id).get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('perm-user-id').value = id;
            document.getElementById('perm-user-email').innerText = data.email;

            document.getElementById('perm-manage-exp').checked = data.permissions?.manageExperiences || false;
            document.getElementById('perm-edit-status').checked = data.permissions?.editStatus || false;
            document.getElementById('perm-delete-bookings').checked = data.permissions?.deleteBookings || false;

            permissionsModal.style.display = 'flex';
        }
    });
};

if (permissionsForm) {
    permissionsForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('perm-user-id').value;
        const data = {
            permissions: {
                manageExperiences: document.getElementById('perm-manage-exp').checked,
                editStatus: document.getElementById('perm-edit-status').checked,
                deleteBookings: document.getElementById('perm-delete-bookings').checked
            }
        };
        try {
            await db.collection('admins').doc(id).update(data);
            showToast('Permisos actualizados', 'success');
            permissionsModal.style.display = 'none';
        } catch (error) {
            showToast('Error: ' + error.message, 'error');
        }
    };
}

document.getElementById('close-permissions-modal').onclick = () => permissionsModal.style.display = 'none';

window.onclick = (e) => {
    if (e.target == detailsModal) detailsModal.style.display = 'none';
    if (e.target == experienceModal) experienceModal.style.display = 'none';
    if (e.target == permissionsModal) permissionsModal.style.display = 'none';
    if (e.target == document.getElementById('add-admin-modal')) document.getElementById('add-admin-modal').style.display = 'none';
};


// ADD ADMIN LOGIC
window.openAddAdminModal = function () {
    document.getElementById('add-admin-form').reset();
    document.getElementById('add-admin-modal').style.display = 'flex';
};

const addAdminForm = document.getElementById('add-admin-form');
if (addAdminForm) {
    addAdminForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('new-admin-email').value.trim().toLowerCase();

        if (!email) return;

        try {
            // Check if already exists in Firestore
            const snapshot = await db.collection('admins').where('email', '==', email).get();
            if (!snapshot.empty) {
                showToast('Este usuario ya está en la lista', 'info');
                document.getElementById('add-admin-modal').style.display = 'none';
                return;
            }

            // Create placeholder doc in Firestore
            await db.collection('admins').add({
                email: email,
                uid: null, // Will be linked on their first login
                permissions: {
                    manageExperiences: false,
                    editStatus: false,
                    deleteBookings: false
                },
                lastLogin: null
            });

            showToast('Usuario vinculado. Ahora puedes asignarle permisos.', 'success');
            document.getElementById('add-admin-modal').style.display = 'none';
        } catch (error) {
            showToast('Error: ' + error.message, 'error');
        }
    };
}

document.getElementById('close-add-admin').onclick = () => document.getElementById('add-admin-modal').style.display = 'none';

window.removeAdmin = async function (id, email) {
    if (email === MASTER_ADMIN) return;
    if (confirm(`¿Estás seguro de eliminar a ${email} de la lista de administradores? (Esto no borra su cuenta de Firebase, solo sus permisos en este panel)`)) {
        try {
            await db.collection('admins').doc(id).delete();
            showToast('Administrador eliminado de la lista', 'success');
        } catch (error) {
            showToast('Error: ' + error.message, 'error');
        }
    }
};

// Booking update/delete
const editBookingForm = document.getElementById('edit-booking-form');
if (editBookingForm) {
    editBookingForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-id').value;
        const data = {
            client: document.getElementById('edit-client').value,
            whatsapp: document.getElementById('edit-whatsapp').value,
            service: document.getElementById('edit-service').value,
            status: document.getElementById('edit-status').value,
            total: parseFloat(document.getElementById('edit-total').value),
            discount: parseFloat(document.getElementById('edit-discount').value) / 100
        };
        try {
            await db.collection('bookings').doc(id).update(data);
            showToast('Reserva actualizada', 'success');
            detailsModal.style.display = 'none';
        } catch (error) {
            showToast('Error: ' + error.message, 'error');
        }
    };
}

const btnDeleteBooking = document.getElementById('btn-delete-booking');
if (btnDeleteBooking) {
    btnDeleteBooking.onclick = async () => {
        const id = document.getElementById('edit-id').value;
        if (id && confirm('¿Borrar reserva?')) {
            try {
                await db.collection('bookings').doc(id).delete();
                showToast('Reserva eliminada', 'success');
                detailsModal.style.display = 'none';
            } catch (error) {
                showToast('Error: ' + error.message, 'error');
            }
        }
    };
}
