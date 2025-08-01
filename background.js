// Background script pour l'extension Post Analyzer
console.log("🚀 Background script démarré");

// Installation de l'extension
chrome.runtime.onInstalled.addListener((details) => {
  console.log("📦 Extension installée:", details.reason);

  if (details.reason === "install") {
    // Première installation
    console.log("🎉 Première installation de Post Analyzer");
  } else if (details.reason === "update") {
    // Mise à jour
    console.log("🔄 Extension mise à jour");
  }
});

// Écouter les messages du content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("📨 Message reçu:", request);

  switch (request.action) {
    case "getCacheStats":
      // Récupérer les statistiques du cache
      handleCacheStats(sendResponse);
      return true; // Réponse asynchrone

    case "clearCache":
      // Vider le cache
      handleClearCache(sendResponse);
      return true;

    case "getStatus":
      // Statut de l'extension
      sendResponse({ status: "active", timestamp: Date.now() });
      break;

    default:
      console.warn("⚠️ Action non reconnue:", request.action);
      sendResponse({ error: "Action non reconnue" });
  }
});

// Gérer les statistiques du cache
async function handleCacheStats(sendResponse) {
  try {
    const result = await chrome.storage.local.get(["post_analysis_cache"]);
    const cache = result.post_analysis_cache
      ? JSON.parse(result.post_analysis_cache)
      : {};
    const stats = {
      cacheSize: Object.keys(cache).length,
      totalEntries: Object.keys(cache).length,
      lastUpdate: Date.now(),
    };
    sendResponse({ success: true, stats });
  } catch (error) {
    console.error("❌ Erreur récupération stats:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Gérer la suppression du cache
async function handleClearCache(sendResponse) {
  try {
    await chrome.storage.local.remove(["post_analysis_cache"]);
    console.log("🗑️ Cache vidé via background script");
    sendResponse({ success: true, message: "Cache vidé" });
  } catch (error) {
    console.error("❌ Erreur suppression cache:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Surveiller les changements de storage
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.post_analysis_cache) {
    console.log("📊 Cache modifié:", {
      oldSize: changes.post_analysis_cache.oldValue
        ? Object.keys(JSON.parse(changes.post_analysis_cache.oldValue)).length
        : 0,
      newSize: changes.post_analysis_cache.newValue
        ? Object.keys(JSON.parse(changes.post_analysis_cache.newValue)).length
        : 0,
    });
  }
});

// Gestion des onglets
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    (tab.url?.includes("facebook.com") || tab.url?.includes("meta.com"))
  ) {
    console.log("🌐 Page Facebook/Meta chargée:", tab.url);

    // Injecter le script si nécessaire
    chrome.scripting
      .executeScript({
        target: { tabId: tabId },
        func: () => {
          console.log("🎯 Script injecté dans la page");
        },
      })
      .catch((err) => {
        console.warn("⚠️ Erreur injection script:", err);
      });
  }
});

// Nettoyage périodique du cache (toutes les heures)
setInterval(async () => {
  try {
    const result = await chrome.storage.local.get(["post_analysis_cache"]);
    if (result.post_analysis_cache) {
      const cache = JSON.parse(result.post_analysis_cache);
      const now = Date.now();
      const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 heures

      let cleaned = 0;
      for (const [key, value] of Object.entries(cache)) {
        if (now - value.timestamp > CACHE_EXPIRY) {
          delete cache[key];
          cleaned++;
        }
      }

      if (cleaned > 0) {
        await chrome.storage.local.set({
          post_analysis_cache: JSON.stringify(cache),
        });
        console.log(
          `🧹 Nettoyage automatique: ${cleaned} entrées expirées supprimées`
        );
      }
    }
  } catch (error) {
    console.error("❌ Erreur nettoyage automatique:", error);
  }
}, 60 * 60 * 1000); // 1 heure
