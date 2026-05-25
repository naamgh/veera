// Prevent the old duplicate keyboard shortcut handler from registering.
// The current keyboard shortcut handler in main.js remains active.
(function(){
  const originalAddEventListener = Document.prototype.addEventListener;

  Document.prototype.addEventListener = function(type, listener, options){
    if(type === 'keydown' && typeof listener === 'function'){
      const source = Function.prototype.toString.call(listener);
      const isLegacyShortcutHandler =
        source.includes('clickIfAvailable("readyBtn")') &&
        source.includes('clickIfAvailable("resumeBtn")') &&
        source.includes('setSetupVisible(false)') &&
        source.includes('intensityFactor');

      if(isLegacyShortcutHandler){
        console.info('Veera: blocked duplicate legacy keyboard shortcut handler.');
        return;
      }
    }

    return originalAddEventListener.call(this, type, listener, options);
  };
})();
