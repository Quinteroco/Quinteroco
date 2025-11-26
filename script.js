const endDate = new Date("2025-11-30T23:59:59"); // Ajusta el año si es 2024 o el actual

function updateCountdown() {
  const now = new Date();
  const diff = endDate - now;

  if (diff <= 0) {
    document.getElementById("countdown").innerHTML = "<p>¡El tiempo terminó!</p>";
    return;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  document.getElementById("days").textContent = days.toString().padStart(2, "0");
  document.getElementById("hours").textContent = hours.toString().padStart(2, "0");
  document.getElementById("minutes").textContent = minutes.toString().padStart(2, "0");
  document.getElementById("seconds").textContent = seconds.toString().padStart(2, "0");
}

setInterval(updateCountdown, 1000);
updateCountdown();


document.querySelectorAll('.faq-question').forEach(question => {
  question.addEventListener('click', () => {
    const faqItem = question.parentElement;
    faqItem.classList.toggle('active');
  });
});


// =============================
// POPUP AUTO-OPEN
// =============================

window.addEventListener("load", () => {
  setTimeout(() => {
    document.getElementById("popup").classList.add("active");
  }, 800); // Se abre 0.8s después de cargar
});

document.querySelector(".popup-close").addEventListener("click", () => {
  document.getElementById("popup").classList.remove("active");
});


// ===================================
// WIDGET: aparece si el popup se cierra
// ===================================

const popup = document.getElementById("popup");
const closeBtn = document.querySelector(".popup-close");
const widget = document.getElementById("guide-widget");

closeBtn.addEventListener("click", () => {
  popup.classList.remove("active");

  // Espera 300ms para que el cierre se vea más natural
  setTimeout(() => {
    widget.classList.add("active");
  }, 300);
});

// Acción al hacer clic → WhatsApp
widget.addEventListener("click", () => {
  window.open(
    "https://wa.me/573019569941?text=Hola%20Orlando%2C%20quisiera%20obtener%20la%20gu%C3%ADa%20y%20la%20clase%2C%20%C2%BFpor%20cu%C3%A1l%20medio%20te%20pago%3F",
    "_blank"
  );
});
