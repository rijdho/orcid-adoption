import { createRoot } from "react-dom/client";
// The shared look (an exact copy of the house style), then this site's own styles.
import "./house/house.css";
import "./house/house-data.css";
import "./index.css";
import { tooltips } from "./house/house-tip.js";
import App from "./App.jsx";

// One floating tooltip for every element with data-tip (house-tip.js; #tip is in index.html).
tooltips();
createRoot(document.getElementById("root")).render(<App />);
