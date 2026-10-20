// Runs before first paint (a plain script in the head): apply the visitor's stored theme
// ("oa-theme"). With no stored choice nothing is set, and house.css follows the operating system.
try {
  var t = localStorage.getItem("oa-theme");
  if (t === "dark" || t === "light") document.documentElement.setAttribute("data-theme", t);
} catch (e) { /* storage blocked: follow the OS */ }
