const nav = document.getElementById("nav");
const toggle = document.getElementById("nav-toggle");

// Achtergrond van de navigatie na scrollen
const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 40);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// Mobiel menu
toggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  toggle.setAttribute("aria-expanded", open);
});
document.querySelectorAll(".nav-links a").forEach((a) =>
  a.addEventListener("click", () => {
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  })
);

// Verberg een foto als die niet laadt, zodat de achtergrondkleur zichtbaar blijft
document.querySelectorAll("img").forEach((img) =>
  img.addEventListener("error", () => (img.style.visibility = "hidden"))
);

// Elementen laten infaden bij scrollen
const revealItems = document.querySelectorAll(".section-head, .service, .project, .split > *, .contact > *, .value, .skill-group, .faq");
revealItems.forEach((el) => el.classList.add("reveal"));
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  revealItems.forEach((el) => io.observe(el));
} else {
  revealItems.forEach((el) => el.classList.add("visible"));
}

// Contactformulier: opent het e-mailprogramma met een ingevuld bericht
const CONTACT_EMAIL = "info@jouwdomein.nl";
const form = document.getElementById("contact-form");
if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const subject = `Aanvraag: ${data.get("type")} – ${data.get("naam")}`;
    const body = `Naam: ${data.get("naam")}\nE-mail: ${data.get("email")}\nType: ${data.get("type")}\nBudget: ${data.get("budget")}\n\n${data.get("bericht")}`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
}

document.getElementById("year").textContent = new Date().getFullYear();
