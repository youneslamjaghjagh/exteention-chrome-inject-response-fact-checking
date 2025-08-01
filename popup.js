// Script pour le popup de l'extension
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🎯 Popup chargé");

  // Éléments DOM
  const cacheCountEl = document.getElementById("cacheCount");
  const statusEl = document.getElementById("status");
  const lastUpdateEl = document.getElementById("lastUpdate");
  const statusMessageEl = document.getElementById("statusMessage");
  const refreshBtn = document.getElementById("refreshStats");
  const clearBtn = document.getElementById("clearCache");
  const reprocessBtn = document.getElementById("reprocessAll");

  // Vérifier l'onglet actuel
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isFacebookPage =
    tab.url?.includes("facebook.com") || tab.url?.includes("meta.com");

  if (!isFacebookPage) {
    statusMessageEl.textContent =
      "⚠️ Naviguez vers Facebook pour utiliser l'extension";
    statusMessageEl.style.color = "#ffeb3b";
  }

  // Charger les stats initiales
  await loadStats();

  // Event listeners
  refreshBtn.addEventListener("click", async () => {
    await handleButtonClick(refreshBtn, loadStats);
  });

  clearBtn.addEventListener("click", async () => {
    await handleButtonClick(clearBtn, clearCache);
  });

  reprocessBtn.addEventListener("click", async () => {
    if (!isFacebookPage) {
      showMessage("⚠️ Allez sur Facebook d'abord", "warning");
      return;
    }
    await handleButtonClick(reprocessBtn, reprocessAll);
  });

  // Charger les statistiques
  async function loadStats() {
    try {
      // Stats du cache depuis le storage
      const result = await chrome.storage.local.get(["post_analysis_cache"]);
      const cache = result.post_analysis_cache
        ? JSON.parse(result.post_analysis_cache)
        : {};

      cacheCountEl.textContent = Object.keys(cache).length;
      lastUpdateEl.textContent = new Date().toLocaleTimeString();

      // Vérifier le statut via le content script
      if (isFacebookPage) {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, {
            action: "getStatus",
          });
          statusEl.textContent = response.active ? "✅ Actif" : "❌ Inactif";
          statusEl.style.color = response.active ? "#4caf50" : "#f44336";
        } catch (error) {
          statusEl.textContent = "⚠️ Non connecté";
          statusEl.style.color = "#ff9800";
        }
      } else {
        statusEl.textContent = "⏸️ En pause";
        statusEl.style.color = "#9e9e9e";
      }
    } catch (error) {
      console.error("❌ Erreur chargement stats:", error);
      showMessage("❌ Erreur chargement des stats", "error");
    }
  }

  // Vider le cache
  async function clearCache() {
    try {
      await chrome.storage.local.remove(["post_analysis_cache"]);

      // Notifier le content script si possible
      if (isFacebookPage) {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: "clearCache" });
        } catch (error) {
          console.warn("Content script non disponible");
        }
      }

      await loadStats();
      showMessage("🗑️ Cache vidé avec succès", "success");
    } catch (error) {
      console.error("❌ Erreur suppression cache:", error);
      showMessage("❌ Erreur lors du vidage", "error");
    }
  }

  // Tout retraiter
  async function reprocessAll() {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "reprocessAll",
      });

      if (response.success) {
        await loadStats();
        showMessage("⚡ Retraitement lancé", "success");
      } else {
        showMessage("❌ Erreur retraitement", "error");
      }
    } catch (error) {
      console.error("❌ Erreur retraitement:", error);
      showMessage("❌ Erreur communication avec la page", "error");
    }
  }

  // Gérer les clics de boutons avec loading
  async function handleButtonClick(button, action) {
    const originalText = button.innerHTML;
    button.classList.add("loading");
    button.innerHTML = '<span class="emoji">⏳</span>Chargement...';

    try {
      await action();
    } finally {
      button.classList.remove("loading");
      button.innerHTML = originalText;
    }
  }

  // Afficher un message de statut
  function showMessage(message, type = "info") {
    statusMessageEl.textContent = message;

    const colors = {
      success: "#4caf50",
      error: "#f44336",
      warning: "#ff9800",
      info: "#2196f3",
    };

    statusMessageEl.style.color = colors[type] || colors.info;

    // Réinitialiser après 3 secondes
    setTimeout(() => {
      statusMessageEl.textContent = isFacebookPage
        ? "Extension active sur Facebook/Meta"
        : "⚠️ Naviguez vers Facebook pour utiliser l'extension";
      statusMessageEl.style.color = "";
    }, 3000);
  }

  // Auto-refresh des stats toutes les 5 secondes
  setInterval(loadStats, 5000);
});
