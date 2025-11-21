const slider = document.getElementById("slider");
const next = document.getElementById("next");
const prev = document.getElementById("prev");

let isDown = false;
let startX;
let scrollLeft;

// --- DRAG & SWIPE MOBILE ---
slider.addEventListener("mousedown", (e) => {
  isDown = true;
  startX = e.pageX - slider.offsetLeft;
  scrollLeft = slider.scrollLeft;
});

slider.addEventListener("mouseleave", () => { isDown = false; });
slider.addEventListener("mouseup", () => { isDown = false; });

slider.addEventListener("mousemove", (e) => {
  if (!isDown) return;
  e.preventDefault();
  const x = e.pageX - slider.offsetLeft;
  const walk = (x - startX) * 1.5; 
  slider.scrollLeft = scrollLeft - walk;
});

// TOUCH
slider.addEventListener("touchstart", (e) => {
  startX = e.touches[0].clientX;
  scrollLeft = slider.scrollLeft;
}, { passive: true });

slider.addEventListener("touchmove", (e) => {
  const x = e.touches[0].clientX;
  const walk = (x - startX) * 1.5;
  slider.scrollLeft = scrollLeft - walk;
}, { passive: true });

// --- BOTONES DESKTOP ---
next.addEventListener("click", () => {
  slider.scrollLeft += 260;
});

prev.addEventListener("click", () => {
  slider.scrollLeft -= 260;
});
