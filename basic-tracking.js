(function() {
  // Basic session management
  function generateSessionId() {
    return Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 9);
  }

  let sessionId = sessionStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem('sessionId', sessionId);
  }

  // Basic data collection utilities
  function getUTMParams() {
    var params = {};
    window.location.search.substring(1).split("&").forEach(function(part) {
      var item = part.split("=");
      params[item[0]] = decodeURIComponent(item[1]);
    });
    return params;
  }

  function getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
    };
  }

  // Data sending function
  function sendData(data) {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "http://13.234.117.8:8000/track", true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify(data));
  }

  // Basic data collection
  function collectAndSendBasicData(clickData = null) {
    var userData = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      referrer: document.referrer,
      utmParameters: getUTMParams(),
      deviceInfo: getDeviceInfo(),
      hostname: window.location.hostname,
      sessionId: sessionId,
      clickData: clickData
    };
    sendData(userData);
  }

  // Click event tracking
  document.addEventListener('click', function(event) {
    if (event.target.tagName.toLowerCase() === 'button' || 
        event.target.classList.contains('add-to-bag-button') || 
        event.target.closest('.add-to-bag-button')) {
      
      var targetElement = event.target.tagName.toLowerCase() === 'button' ? 
        event.target : 
        (event.target.classList.contains('add-to-bag-button') ? 
          event.target : 
          event.target.closest('.add-to-bag-button'));

      var clickData = {
        'target': targetElement.tagName.toLowerCase(),
        'value': targetElement.value || null,
        'type': targetElement.type || null,
        'id': targetElement.id,
        'classes': targetElement.className,
        'innerText': targetElement.innerText,
        'innerHTML': targetElement.innerHTML,
        'href': targetElement.getAttribute('href'),
        'timestamp': new Date().toISOString()
      };

      collectAndSendBasicData(clickData);
    }
  });

  // Initial page load tracking
  collectAndSendBasicData();

  // URL change detection
  let lastUrl = window.location.href;
  setInterval(function() {
    var currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      collectAndSendBasicData();
    }
  }, 500);

  // Expose session ID for other scripts
  window.trackingData = {
    sessionId: sessionId
  };
})();
