// Dark Mode
const toggleBtn = document.getElementById("toggleDark");
const htmlEl = document.documentElement;
const iconSun = document.getElementById("iconSun");
const iconMoon = document.getElementById("iconMoon");

function updateIcon() {
  if (!iconSun || !iconMoon) return;

  if (htmlEl.classList.contains("dark")) {
    iconSun.classList.add("hidden");
    iconMoon.classList.remove("hidden");
  } else {
    iconSun.classList.remove("hidden");
    iconMoon.classList.add("hidden");
  }
}

if (localStorage.getItem("darkMode") === "true") {
  htmlEl.classList.add("dark");
}
updateIcon();

if (toggleBtn) {
  toggleBtn.addEventListener("click", () => {
    htmlEl.classList.toggle("dark");
    localStorage.setItem("darkMode", htmlEl.classList.contains("dark"));
    updateIcon();
  });
}

// Nav Link
const navLinks = document.querySelectorAll('.nav-link');
const currentPath = window.location.pathname;
navLinks.forEach(link => {
  if (link.getAttribute('href') === currentPath) {
    link.classList.add('text-sky-500', 'font-semibold');
    const underline = link.querySelector('.underline');
    if (underline) underline.style.width = '100%';
  }
});