// =====================================================================
// SKYDROP II — FIREBASE INTEGRATION
// =====================================================================
// SETUP INSTRUCTIONS:
// 1. Go to https://console.firebase.google.com/
// 2. Click "Create a project" → name it "skydrop" → Continue
// 3. Disable Google Analytics (not needed) → Create Project
// 4. Click the web icon </> to add a web app → name it "skydrop-web"
// 5. Copy your firebaseConfig object and paste it below (replace the placeholder)
// 6. In the Firebase console sidebar:
//    a. Build → Realtime Database → Create Database → Start in TEST mode → Enable
//    b. Build → Authentication → Get Started → Enable "Anonymous" sign-in
// 7. Deploy your frontend — Firebase is ready!
//
// SECURITY RULES (set in Firebase Console → Realtime Database → Rules):
// {
//   "rules": {
//     "config": {
//       ".read": true,
//       ".write": "auth != null && root.child('admins').child(auth.uid).exists()"
//     },
//     "chat": {
//       ".read": true,
//       ".write": "auth != null",
//       "$msgId": {
//         ".validate": "newData.hasChildren(['name','text','time','uid'])"
//       }
//     },
//     "rounds": {
//       ".read": true,
//       ".write": "auth != null"
//     },
//     "admins": {
//       ".read": "auth != null",
//       ".write": false
//     }
//   }
// }
// =====================================================================

// ██ PASTE YOUR FIREBASE CONFIG HERE ██
var FIREBASE_CONFIG = {
  apiKey: "AIzaSyAPPjhU1xFqVYVu4nxvTkTKxgCtO9ltN4U",
  authDomain: "skydrop-9b21b.firebaseapp.com",
  databaseURL: "https://skydrop-9b21b-default-rtdb.firebaseio.com",
  projectId: "skydrop-9b21b",
  storageBucket: "skydrop-9b21b.firebasestorage.app",
  messagingSenderId: "665217333875",
  appId: "1:665217333875:web:109afc988eae507f80c806"
};

// =====================================================================
// FIREBASE BRIDGE — connects game + panel to Firebase Realtime Database
// Falls back to localStorage when Firebase is not configured
// =====================================================================
var FB = (function() {
  var _db = null;
  var _auth = null;
  var _uid = null;
  var _isAdmin = false;
  var _ready = false;
  var _onReadyCbs = [];
  var _configCbs = [];
  var _chatCbs = [];

  // Check if config is filled in
  function _isConfigured() {
    return FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey !== 'YOUR_API_KEY';
  }

  // Initialize Firebase
  function init() {
    if (!_isConfigured()) {
      console.log('[SkyDrop Firebase] Not configured — using localStorage fallback');
      _ready = true;
      _onReadyCbs.forEach(function(cb) { try { cb(false); } catch(e) {} });
      _onReadyCbs = [];
      return;
    }
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      _db = firebase.database();
      _auth = firebase.auth();

      // Sign in anonymously
      _auth.signInAnonymously().then(function(result) {
        _uid = result.user.uid;
        console.log('[SkyDrop Firebase] Signed in:', _uid);

        // Check admin status
        _db.ref('admins/' + _uid).once('value').then(function(snap) {
          _isAdmin = !!snap.val();
          if (_isAdmin) console.log('[SkyDrop Firebase] Admin mode enabled');
          _ready = true;
          _onReadyCbs.forEach(function(cb) { try { cb(true); } catch(e) {} });
          _onReadyCbs = [];
        });
      }).catch(function(err) {
        console.warn('[SkyDrop Firebase] Auth failed:', err.message);
        _ready = true;
        _onReadyCbs.forEach(function(cb) { try { cb(false); } catch(e) {} });
        _onReadyCbs = [];
      });
    } catch(e) {
      console.warn('[SkyDrop Firebase] Init failed:', e.message);
      _ready = true;
      _onReadyCbs.forEach(function(cb) { try { cb(false); } catch(e2) {} });
      _onReadyCbs = [];
    }
  }

  function onReady(cb) {
    if (_ready) { cb(_isConfigured() && !!_db); }
    else { _onReadyCbs.push(cb); }
  }

  function isOnline() { return !!_db; }
  function isAdmin() { return _isAdmin; }
  function getUid() { return _uid; }

  // ─── CONFIG ───
  // Listen for config changes (real-time)
  function onConfigChange(cb) {
    _configCbs.push(cb);
    if (!_db) return;
    _db.ref('config').on('value', function(snap) {
      var val = snap.val();
      if (val) {
        _configCbs.forEach(function(fn) { try { fn(val); } catch(e) {} });
      }
    });
  }

  // Save config (admin only)
  function saveConfig(data) {
    if (!_db) {
      // Fallback: localStorage
      localStorage.setItem('skydrop_admin_config', JSON.stringify(data));
      return Promise.resolve();
    }
    return _db.ref('config').set(data).then(function() {
      // Also save to localStorage as fallback
      localStorage.setItem('skydrop_admin_config', JSON.stringify(data));
    });
  }

  // Load config once
  function loadConfig() {
    if (!_db) {
      try {
        var s = localStorage.getItem('skydrop_admin_config');
        return Promise.resolve(s ? JSON.parse(s) : null);
      } catch(e) { return Promise.resolve(null); }
    }
    return _db.ref('config').once('value').then(function(snap) { return snap.val(); });
  }

  // ─── CHAT ───
  // Send a chat message
  function sendChatMsg(msg) {
    if (!_db || !_uid) return;
    var data = {
      name: msg.name || 'Player',
      avatar: msg.avatar || '🧑‍✈️',
      bg: msg.bg || 'rgba(76,175,80,.12)',
      text: msg.text,
      time: firebase.database.ServerValue.TIMESTAMP,
      uid: _uid
    };
    _db.ref('chat').push(data);
  }

  // Listen for new chat messages
  function onChat(cb) {
    if (!_db) return;
    // Only get last 80 messages
    _db.ref('chat').orderByChild('time').limitToLast(80).on('child_added', function(snap) {
      var val = snap.val();
      if (val) {
        val._key = snap.key;
        val.isMe = (val.uid === _uid);
        // Convert timestamp to HH:MM
        if (typeof val.time === 'number') {
          var d = new Date(val.time);
          val.timeStr = d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
        } else {
          val.timeStr = val.time || '';
        }
        try { cb(val); } catch(e) {}
      }
    });
  }

  // ─── ROUNDS ───
  // Push a round result
  function pushRound(data) {
    if (!_db) return;
    _db.ref('rounds').push({
      v: data.v,
      round: data.round,
      players: data.players,
      totalBet: data.totalBet,
      result: data.result,
      time: data.time,
      ts: firebase.database.ServerValue.TIMESTAMP
    });
    // Keep only last 500 rounds (cleanup old data)
    _db.ref('rounds').orderByChild('ts').limitToFirst(1).once('value', function(snap) {
      snap.forEach(function(child) {
        _db.ref('rounds').once('value', function(allSnap) {
          if (allSnap.numChildren() > 500) { child.ref.remove(); }
        });
      });
    });
  }

  // Load all rounds (for dashboard)
  function loadRounds() {
    if (!_db) {
      try {
        var h = localStorage.getItem('skydrop_history');
        return Promise.resolve(h ? JSON.parse(h) : []);
      } catch(e) { return Promise.resolve([]); }
    }
    return _db.ref('rounds').orderByChild('ts').limitToLast(500).once('value').then(function(snap) {
      var arr = [];
      snap.forEach(function(child) { arr.unshift(child.val()); });
      return arr;
    });
  }

  // Listen for new rounds (real-time dashboard)
  function onNewRound(cb) {
    if (!_db) return;
    _db.ref('rounds').orderByChild('ts').limitToLast(1).on('child_added', function(snap) {
      var val = snap.val();
      if (val) { try { cb(val); } catch(e) {} }
    });
  }

  // ─── ADMIN ───
  // Make current user an admin (run once from browser console)
  // Usage: FB.makeAdmin()
  function makeAdmin() {
    if (!_db || !_uid) { console.log('Firebase not ready'); return; }
    _db.ref('admins/' + _uid).set(true).then(function() {
      _isAdmin = true;
      console.log('[SkyDrop] You are now admin! UID:', _uid);
      console.log('[SkyDrop] After setting security rules, only existing admins can add new ones.');
    });
  }

  // ─── FACTORY RESET ───
  function factoryReset() {
    if (!_db) return Promise.resolve();
    return Promise.all([
      _db.ref('config').remove(),
      _db.ref('chat').remove(),
      _db.ref('rounds').remove()
    ]);
  }

  return {
    init: init,
    onReady: onReady,
    isOnline: isOnline,
    isAdmin: isAdmin,
    getUid: getUid,
    onConfigChange: onConfigChange,
    saveConfig: saveConfig,
    loadConfig: loadConfig,
    sendChatMsg: sendChatMsg,
    onChat: onChat,
    pushRound: pushRound,
    loadRounds: loadRounds,
    onNewRound: onNewRound,
    makeAdmin: makeAdmin,
    factoryReset: factoryReset
  };
})();

// Auto-initialize when script loads
FB.init();
