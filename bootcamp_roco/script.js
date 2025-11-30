document.addEventListener("DOMContentLoaded", () => {

  // --- HELPERS ---
  function scrollToElement(el, offset = 40) {
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  }

  // --- Smooth scroll para enlaces tipo #anchor ---
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener("click", function(e) {
      const href = this.getAttribute("href");
      if (!href || href === "#") return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        scrollToElement(target, 40);
      }
    });
  });

  // --- Widget: scroll al formulario ---
  const widget = document.querySelector(".inscribe-widget");
  if (widget) {
    widget.addEventListener("click", () => {
      const formContainer = document.getElementById("form");
      scrollToElement(formContainer, 40);
    });
  }

  // --- FAQ toggle ---
  document.querySelectorAll('.faq-question').forEach(q => {
    q.addEventListener('click', () => q.parentElement.classList.toggle('active'));
  });

  // --- Popup (redes) ---
  const popup = document.getElementById("social-popup");
  function openPopup() { if (popup) popup.classList.add("active"); }
  function closePopup() { if (popup) popup.classList.remove("active"); }

  document.querySelectorAll('#social-popup button').forEach(btn => {
    btn.addEventListener('click', closePopup);
  });

  if (popup) {
    popup.addEventListener('click', (e) => { if (e.target === popup) closePopup(); });
  }

  // --- Form submit: abrir popup y resetear ---
  const form = document.getElementById("contact-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      // No preventDefault para que el form se envíe nativamente y evite CORS
      
      if (!form.checkValidity()) {
        form.reportValidity();
        e.preventDefault();
        return;
      }
      // Espera que el form se envíe a la URL del action en el iframe oculto
      // Evento de Meta (Lead)
      fbq('track', 'Lead');
      // Solo abre el popup y limpia el form después de un pequeño delay
      setTimeout(() => {
        openPopup();
        form.reset();
      }, 500);
    });
  }

}); // end DOMContentLoaded





