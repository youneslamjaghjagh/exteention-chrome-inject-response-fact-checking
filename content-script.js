let postIndex = 0;
const pendingPosts = new Set();
const processedPosts = new Set();
const observedPosts = new Set(); // Pour éviter d'observer plusieurs fois le même post

//  Système de cache pour stocker les résultats
const analysisCache = new Map();
const CACHE_KEY = "post_analysis_cache";
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 heures

//  Charger le cache depuis localStorage au démarrage
function loadCache() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsedCache = JSON.parse(cached);
      for (const [key, value] of Object.entries(parsedCache)) {
        // Vérifier si le cache n'a pas expiré
        if (Date.now() - value.timestamp < CACHE_EXPIRY) {
          analysisCache.set(key, value);
        }
      }
      console.log(` Cache chargé : ${analysisCache.size} entrées`);
    }
  } catch (error) {
    console.error("Erreur lors du chargement du cache :", error);
  }
}

//  Sauvegarder le cache dans localStorage
function saveCache() {
  try {
    const cacheObject = Object.fromEntries(analysisCache);
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheObject));
  } catch (error) {
    console.error("Erreur lors de la sauvegarde du cache :", error);
  }
}

//  Générer une clé de cache basée sur le contenu
function generateCacheKey(text) {
  // Normaliser le texte pour une clé stable
  const normalizedText = text.trim().toLowerCase().replace(/\s+/g, " ");
  return btoa(encodeURIComponent(normalizedText)).substring(0, 32); // Hash simple
}

function extractTextFromHTML(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");
  return doc.body.textContent || "";
}

//  Extraire uniquement le contenu principal du post (pas les commentaires)
function extractMainPostContent(postElement) {
  try {
    // Cloner l'élément pour ne pas modifier l'original
    const clonedPost = postElement.cloneNode(true);

    // Supprimer les sections de commentaires
    const commentSelectors = [
      ".UFIContainer",
      '[data-testid="ufi_comment_list"]',
      ".comments",
      ".UFIRow",
      '.userContent + div[role="button"]',
      ".UFICommentContainer",
      '[aria-label*="comment"]',
      ".comment",
      '[data-testid*="comment"]',
      ".UFILikeLink",
      ".UFICommentLink",
      ".UFIShareLink",
    ];

    commentSelectors.forEach((selector) => {
      const elements = clonedPost.querySelectorAll(selector);
      elements.forEach((el) => el.remove());
    });

    // Se concentrer uniquement sur la classe spécifiée
    const mainContent = clonedPost.querySelector(
      ".xdj266r.x14z9mp.xat24cr.x1lziwak.x1vvkbs.x126k92a"
    );

    // Si le contenu principal est trouvé, l'utiliser, sinon utiliser l'élément complet
    if (mainContent) {
      return extractTextFromHTML(mainContent.innerHTML);
    } else {
      // Recherche plus profonde dans les div internes
      const internalDivs = clonedPost.querySelectorAll("div[dir='auto']");
      let combinedText = "";

      internalDivs.forEach((div) => {
        const text = div.textContent.trim();
        if (text.length > 0) {
          combinedText += text + " ";
        }
      });

      if (combinedText.length > 0) {
        return combinedText.trim();
      }

      // Fallback si rien n'est trouvé
      return extractTextFromHTML(clonedPost.innerHTML);
    }
  } catch (error) {
    console.warn("Erreur extraction contenu principal:", error);
    return extractTextFromHTML(postElement.innerHTML);
  }
}

// 🚫 Vérifier si un élément est un commentaire
function isComment(element) {
  // Classes et attributs typiques des commentaires
  const commentIndicators = [
    "UFIContainer",
    "UFIRow",
    "UFIComment",
    "comment",
    "commentContainer",
  ];

  // Vérifier les classes
  const classList = element.className || "";
  if (commentIndicators.some((indicator) => classList.includes(indicator))) {
    return true;
  }

  // Vérifier les attributs data-testid
  const testId = element.getAttribute("data-testid") || "";
  if (testId.includes("comment") || testId.includes("ufi")) {
    return true;
  }

  // Vérifier si l'élément est dans une section de commentaires
  const commentParent = element.closest(
    '.UFIContainer, [data-testid="ufi_comment_list"], .comments'
  );
  if (commentParent) {
    return true;
  }

  return false;
}

// 🚫 Vérifier si l'élément est un sous-élément d'un post déjà traité
function isSubElement(element) {
  // Vérifier si l'élément est enfant d'un élément déjà identifié comme post
  const parentPost = element.closest(
    ".xdj266r.x14z9mp.xat24cr.x1lziwak.x1vvkbs.x126k92a"
  );
  if (parentPost && parentPost !== element) {
    return true;
  }

  return false;
}

function generatePostId(index) {
  return `post-${index}`;
}

// 📍 Générer un ID unique basé sur le contenu principal du post
function generateUniquePostId(post) {
  // Essayer d'utiliser un attribut existant ou le contenu pour créer un ID stable
  const textContent = extractMainPostContent(post);
  const shortHash = btoa(
    encodeURIComponent(textContent.substring(0, 100))
  ).substring(0, 16);
  return `post-${shortHash}-${postIndex++}`;
}

// 🔍 Vérifier si un post a déjà son résultat injecté
function hasInjectedResult(post) {
  return post.querySelector(".analysis-result") !== null;
}

// 🧹 Nettoyer les résultats injectés (pour re-injection)
function clearInjectedResult(post) {
  const existingResult = post.querySelector(".analysis-result");
  if (existingResult) {
    existingResult.remove();
  }
}

// 💉 Injecter le résultat dans un post
// function injectResult(post, postId, result) {
//   // Nettoyer d'abord tout résultat existant
//   clearInjectedResult(post);

//   try {
//     const resultBox = document.createElement("div");
//     resultBox.className = "analysis-result"; // Classe pour identification
//     resultBox.style.cssText = `
//       margin-top: 10px;
//       padding: 8px;
//       background-color: #008000;
//       border: 1px solid #008000;
//       border-radius: 6px;
//       font-size: 14px;
//       color: white;
//       font-weight: bold;
//       z-index: 9999;
//       position: relative;
//     `;

//     resultBox.textContent = `🧠 Analyse : ${result}`;

//     // Cibler spécifiquement l'élément avec la classe demandée
//     const contentArea =
//       post.querySelector(
//         ".xdj266r.x14z9mp.xat24cr.x1lziwak.x1vvkbs.x126k92a"
//       ) || post;

//     contentArea.appendChild(resultBox);
//     post.dataset.analyzed = "true";
//     post.dataset.postId = postId;

//     console.log(`✅ Résultat injecté pour ${postId}`);
//   } catch (error) {
//     console.error(`Erreur d'injection pour ${postId}:`, error);
//   }
// }
function injectResult(post, postId, result) {
  // Nettoyer d'abord tout résultat existant
  clearInjectedResult(post);

  try {
    // Convertir le résultat en minuscules pour une comparaison insensible à la casse
    const resultLower = result.toLowerCase();

    let displayText = "";
    let backgroundColor = "";
    let borderColor = "";

    // Vérifier les différents cas possibles
    if (
      resultLower.indexOf("true") !== -1 &&
      resultLower.indexOf("expressive") === -1
    ) {
      displayText = "True";
      backgroundColor = "#008000"; // Vert
      borderColor = "#008000";
    } else if (
      resultLower.indexOf("expressive true") !== -1 ||
      (resultLower.indexOf("expressive") !== -1 &&
        resultLower.indexOf("true") !== -1)
    ) {
      displayText = "Expressive True";
      backgroundColor = "#9ACD32"; // Jaune-vert
      borderColor = "#9ACD32";
    } else if (
      resultLower.indexOf("expressive false") !== -1 ||
      (resultLower.indexOf("expressive") !== -1 &&
        resultLower.indexOf("false") !== -1)
    ) {
      displayText = "Expressive False";
      backgroundColor = "#f06900"; // Rouge
      borderColor = "#f06900";
    } else if (resultLower.indexOf("false") !== -1) {
      displayText = "False";
      backgroundColor = "#FF0000"; // Rouge
      borderColor = "#FF0000";
    } else {
      // Cas par défaut si aucune correspondance
      displayText = result;
      backgroundColor = "#666666"; // Gris
      borderColor = "#666666";
    }

    const resultBox = document.createElement("div");
    resultBox.className = "analysis-result"; // Classe pour identification
    resultBox.style.cssText = `
      margin-top: 10px;
      padding: 8px;
      background-color: ${backgroundColor};
      border: 1px solid ${borderColor};
      border-radius: 6px;
      font-size: 14px;
      color: white;
      font-weight: bold;
      z-index: 9999;
      position: relative;
    `;

    resultBox.textContent = `🧠 Analyse : ${displayText}`;

    // Cibler spécifiquement l'élément avec la classe demandée
    const contentArea =
      post.querySelector(
        ".xdj266r.x14z9mp.xat24cr.x1lziwak.x1vvkbs.x126k92a"
      ) || post;

    contentArea.appendChild(resultBox);
    post.dataset.analyzed = "true";
    post.dataset.postId = postId;

    console.log(`✅ Résultat injecté pour ${postId}: ${displayText}`);
  } catch (error) {
    console.error(`Erreur d'injection pour ${postId}:`, error);
  }
}

// Remplacer la fonction analyzePostWithId par celle-ci
async function analyzePostWithId(text, postId) {
  const cacheKey = generateCacheKey(text);

  // 🔍 Vérifier d'abord dans le cache
  if (analysisCache.has(cacheKey)) {
    const cached = analysisCache.get(cacheKey);
    console.log(`📋 Résultat trouvé dans le cache pour ${postId}`);
    return cached.result;
  }

  // 🌐 Appel API si pas en cache
  try {
    console.log(`🌐 Analyse en cours pour ${postId}...`);

    // Vérifier si le serveur local est en cours d'exécution
    try {
      // Tentative avec le serveur local
      const response = await fetch(
        `http://127.0.0.1:5000/ask?html=${encodeURIComponent(
          text
        )}&id=${encodeURIComponent(postId)}`,
        {
          method: "GET",
          mode: "cors",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) throw new Error("Erreur de réponse du serveur");

      const data = await response.json();

      // 💾 Stocker dans le cache
      analysisCache.set(cacheKey, {
        result: data.response,
        timestamp: Date.now(),
        postId: postId,
      });

      // Sauvegarder le cache
      saveCache();

      return data.response;
    } catch (error) {
      console.warn(
        "Serveur local non disponible, utilisation du mode de secours"
      );
      return "📊 Post analysé (mode local non disponible)";
    }
  } catch (error) {
    console.error(`Erreur d'analyse pour ${postId} :`, error);
    return "⚠️ Erreur d'analyse.";
  }
}

// 🎯 Sélecteurs pour capturer uniquement les posts principaux (pas les commentaires)
function getAllPostSelectors() {
  return [
    // Uniquement le sélecteur spécifié
    ".xdj266r.x14z9mp.xat24cr.x1lziwak.x1vvkbs.x126k92a",
  ];
}

// 🔍 Récupérer tous les posts avec tous les sélecteurs (contenu principal uniquement)
function getAllPosts() {
  const allPosts = new Set();
  const selectors = getAllPostSelectors();

  selectors.forEach((selector) => {
    try {
      const posts = document.querySelectorAll(selector);
      posts.forEach((post) => {
        // Exclure les commentaires et éléments non-posts
        if (isComment(post) || isSubElement(post)) {
          return;
        }

        // Vérifier que c'est bien un post avec du contenu principal
        const textContent = extractMainPostContent(post);
        if (textContent && textContent.length > 10) {
          allPosts.add(post);
        }
      });
    } catch (error) {
      console.warn(`Erreur avec le sélecteur ${selector}:`, error);
    }
  });

  console.log(`🔍 ${allPosts.size} posts principaux trouvés`);
  return Array.from(allPosts);
}

// 👁️ Observer les changements dans les posts existants
function observePostChanges() {
  const posts = getAllPosts();
  posts.forEach((post) => {
    const postId = post.dataset.postId;
    // Autre logique si nécessaire
  });
}

// 🔄 Traitement principal des posts
async function processPosts() {
  const posts = getAllPosts();
  console.log(`🔄 Traitement de ${posts.length} posts...`);

  for (const post of posts) {
    // Génère ou récupère un ID HTML unique
    let postId = post.id || post.dataset.postId;
    if (!postId) {
      postId = generateUniquePostId(post);
      post.id = postId;
    }

    // Ignore si déjà en cours de traitement
    if (pendingPosts.has(postId)) continue;

    const htmlContent = post.innerHTML;
    const cleanText = extractMainPostContent(post); // Utiliser la fonction spécialisée

    // Ignore si trop court
    if (!cleanText || cleanText.length < 10) continue;

    // Vérifier si déjà analysé et résultat présent
    if (post.dataset.analyzed === "true" && hasInjectedResult(post)) {
      processedPosts.add(postId);
      continue;
    }

    // Vérifier si on a le résultat en cache
    const cacheKey = generateCacheKey(cleanText);
    if (analysisCache.has(cacheKey)) {
      const cached = analysisCache.get(cacheKey);
      console.log(`📋 Injection depuis le cache pour ${postId}`);
      injectResult(post, postId, cached.result);
      processedPosts.add(postId);
      continue;
    }

    // Traiter si pas encore fait
    if (!processedPosts.has(postId)) {
      pendingPosts.add(postId);

      try {
        // Traite le post (avec cache automatique)
        const result = await analyzePostWithId(cleanText, postId);

        // Injecte le résultat
        injectResult(post, postId, result);

        // Met à jour les listes
        processedPosts.add(postId);
      } catch (error) {
        console.error(`Erreur lors du traitement de ${postId}:`, error);
      } finally {
        pendingPosts.delete(postId);
      }
    }
  }
}

// 📜 Observer le scroll et les nouveaux contenus
function setupScrollObserver() {
  const observer = new MutationObserver((mutations) => {
    let hasNewContent = false;

    mutations.forEach((mutation) => {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Vérifier si le nœud ajouté est un post ou contient des posts
            const selectors = getAllPostSelectors();
            const isPost = selectors.some((selector) => {
              try {
                return node.matches(selector) || node.querySelector(selector);
              } catch (e) {
                return false;
              }
            });

            if (isPost) {
              hasNewContent = true;
            }
          }
        });
      }
    });

    // Si du nouveau contenu est détecté, traiter les posts
    if (hasNewContent) {
      setTimeout(processPosts, 500); // Délai pour laisser le DOM se stabiliser
    }
  });

  // Observer le document entier pour les changements
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log("👁️ Observateur de scroll configuré");
}

// Fonction pour traiter tous les posts visibles
async function processAllVisiblePosts() {
  await processPosts();
  console.log("✅ Tous les posts visibles ont été traités");
}

// Initialisation et démarrage
function initialize() {
  console.log("🚀 Initialisation de l'extension d'analyse de posts...");

  // Charger le cache
  loadCache();

  // Configurer l'observateur de scroll
  setupScrollObserver();

  // Premier traitement des posts
  setTimeout(processAllVisiblePosts, 1000);

  // Traitement périodique (toutes les 30 secondes)
  setInterval(processAllVisiblePosts, 30000);

  console.log("✅ Extension initialisée avec succès");
}

// Écouter les messages du popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("📨 Message reçu:", message);

  if (message.action === "getStatus") {
    sendResponse({ active: true });
  } else if (message.action === "clearCache") {
    analysisCache.clear();
    localStorage.removeItem(CACHE_KEY);
    console.log("🗑️ Cache vidé");
    sendResponse({ success: true });
  } else if (message.action === "reprocessAll") {
    processedPosts.clear();
    const posts = getAllPosts();
    posts.forEach((post) => {
      post.dataset.analyzed = "false";
      clearInjectedResult(post);
    });
    processAllVisiblePosts();
    sendResponse({ success: true });
  }

  return true; // Indique que la réponse sera envoyée de manière asynchrone
});

// Lancer l'initialisation lorsque le DOM est prêt
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
