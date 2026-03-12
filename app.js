
// =====================================================================
// SKYDROP II — REFACTORED CLEAN BUILD
// Round loop: BETTING(6s) → EXPLODE(2.2s) → FREEFALL → CRASH(3s) → repeat
// =====================================================================

var BET_TIME=6, EXPLODE_TIME=2.2, CRASH_WAIT=3;

// ======================== SFX ENGINE ========================
var sfx={
  ctx:null,soundOn:true,musicOn:true,soundVol:.7,musicVol:.4,
  bgOn:false,bgGain:null,sfxGain:null,_ready:false,
  _drones:[],_chordI:null,_bellI:null,_launchNodes:[],_verb:null,

  init:function(){
    if(this._ready)return;
    try{
      this.ctx=new(window.AudioContext||window.webkitAudioContext);
      this.sfxGain=this.ctx.createGain();this.sfxGain.gain.value=this.soundOn?this.soundVol:0;this.sfxGain.connect(this.ctx.destination);
      this.bgGain=this.ctx.createGain();this.bgGain.gain.value=this.musicOn?this.musicVol:0;this.bgGain.connect(this.ctx.destination);
      // Simple reverb via delay feedback
      this._verb=this.ctx.createConvolver();
      var len=this.ctx.sampleRate*2.5,buf=this.ctx.createBuffer(2,len,this.ctx.sampleRate);
      for(var ch=0;ch<2;ch++){var d=buf.getChannelData(ch);for(var i=0;i<len;i++){d[i]=(Math.random()*2-1)*Math.pow(1-i/len,1.8)}}
      this._verb.buffer=buf;
      var verbG=this.ctx.createGain();verbG.gain.value=.3;
      this._verb.connect(verbG);verbG.connect(this.bgGain);
      this._ready=true;
    }catch(e){}
  },

  res:function(){if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume().catch(function(){})},

  // === ORGANIC AMBIENT MUSIC ===
  startBG:function(){
    if(this.bgOn||!this._ready)return;this.res();this.bgOn=true;
    var self=this,c=this.ctx;
    // Warm pad — 2 detuned sines per voice for natural chorus
    var voices=[[110,110.8],[82.41,82.8],[146.83,147.3]];
    voices.forEach(function(pair){
      pair.forEach(function(f){
        var o=c.createOscillator(),g=c.createGain(),lp=c.createBiquadFilter();
        o.type='sine';o.frequency.value=f;lp.type='lowpass';lp.frequency.value=250;lp.Q.value=.5;
        g.gain.value=.018;o.connect(lp);lp.connect(g);g.connect(self.bgGain);o.start();
        self._drones.push({o:o,g:g,lp:lp});
      });
    });
    // Soft noise bed
    var buf=c.createBuffer(1,c.sampleRate*3,c.sampleRate),d=buf.getChannelData(0);
    for(var i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    var ns=c.createBufferSource(),ng=c.createGain(),bp=c.createBiquadFilter();
    ns.buffer=buf;ns.loop=true;bp.type='lowpass';bp.frequency.value=800;bp.Q.value=.1;
    ng.gain.value=.003;ns.connect(bp);bp.connect(ng);ng.connect(self.bgGain);ns.start();
    self._drones.push({o:ns,g:ng});
    // Bell-like notes — occasional soft piano-ish tones through reverb
    this._startBells();
    this._startPadBreathing();
  },

  _startBells:function(){
    var self=this;
    // Pentatonic scale for natural feel
    var scale=[220,261.63,329.63,392,523.25,659.25,783.99];
    this._bellI=setInterval(function(){
      if(!self.musicOn||!self.ctx)return;
      if(Math.random()>.4)return; // sparse — not every tick plays
      var f=scale[Math.floor(Math.random()*scale.length)];
      var n=self.ctx.currentTime;
      // FM synthesis for bell/piano tone
      var mod=self.ctx.createOscillator(),modG=self.ctx.createGain();
      mod.type='sine';mod.frequency.value=f*2.01;modG.gain.value=f*.5;
      var car=self.ctx.createOscillator(),carG=self.ctx.createGain();
      car.type='sine';car.frequency.value=f;
      mod.connect(modG);modG.connect(car.frequency);
      carG.gain.setValueAtTime(.015,n);
      carG.gain.exponentialRampToValueAtTime(.001,n+3);
      modG.gain.exponentialRampToValueAtTime(.001,n+1.5);
      car.connect(carG);carG.connect(self.bgGain);
      carG.connect(self._verb); // send to reverb
      mod.start(n);car.start(n);mod.stop(n+3.5);car.stop(n+3.5);
      mod.onended=function(){try{mod.disconnect();modG.disconnect();car.disconnect();carG.disconnect()}catch(e){}};
    },2500);
  },

  _startPadBreathing:function(){
    var self=this;
    // Slowly modulate pad filter and volume for organic breathing
    this._chordI=setInterval(function(){
      if(!self.musicOn||!self.ctx)return;
      var n=self.ctx.currentTime;
      self._drones.forEach(function(d){
        if(d.lp){
          var target=180+Math.random()*150;
          d.lp.frequency.linearRampToValueAtTime(target,n+5);
        }
        if(d.g&&d.o&&d.o.frequency){
          d.g.gain.linearRampToValueAtTime(.012+Math.random()*.012,n+4);
        }
      });
    },6000);
  },

  // === SOUND EFFECTS ===
  play:function(t){
    if(!this.soundOn)return;
    if(!this._ready){this.init();this.res()}
    if(!this._ready||!this.ctx)return;
    this.res();if(!this.bgOn&&this.musicOn)this.startBG();
    var n=this.ctx.currentTime,s=this;
    try{
      if(t==='bet'){
        s._osc(880,n,n+.04,.07,'sine');
        s._osc(1320,n+.02,n+.06,.04,'sine');
      }
      else if(t==='launch'){
        // Rocket rumble — continuous, save references to stop later
        s._launchNodes.forEach(function(nd){try{nd.g.gain.linearRampToValueAtTime(0,s.ctx.currentTime+.1);nd.o.stop(s.ctx.currentTime+.15)}catch(e){}});
        s._launchNodes=[];
        var r1=s._osc(45,n,n+8,.08,'triangle');
        var r2=s._osc(70,n,n+8,.05,'sine');
        var r3=s._osc(120,n+.1,n+8,.03,'sawtooth');
        if(r1){r1.o.frequency.linearRampToValueAtTime(150,n+3);s._launchNodes.push(r1)}
        if(r2){r2.o.frequency.linearRampToValueAtTime(200,n+4);s._launchNodes.push(r2)}
        if(r3){r3.o.frequency.linearRampToValueAtTime(250,n+5);s._launchNodes.push(r3)}
      }
      else if(t==='jump'){
        // Stop rocket sound
        s._launchNodes.forEach(function(nd){
          try{nd.g.gain.linearRampToValueAtTime(0,n+.3);nd.o.stop(n+.4)}catch(e){}
        });
        s._launchNodes=[];
        // Eject pop + whoosh
        s._osc(1800,n,n+.04,.1,'sine');
        s._osc(600,n+.02,n+.12,.06,'triangle');
        var w=s._osc(250,n+.05,n+.6,.05,'sine');
        if(w)w.o.frequency.exponentialRampToValueAtTime(60,n+.6);
      }
      else if(t==='cashout'){
        var notes=[523.25,659.25,783.99,1046.5];
        notes.forEach(function(f,i){s._osc(f,n+i*.08,n+i*.08+.2,.06,'sine')});
        s._osc(2093,n+.32,n+.6,.02,'sine');
      }
      else if(t==='chute'){
        s._osc(100,n,n+.06,.12,'triangle');
        s._osc(60,n+.01,n+.3,.08,'sine');
        var fl=s._osc(400,n+.06,n+.7,.04,'sine');
        if(fl)fl.o.frequency.exponentialRampToValueAtTime(80,n+.7);
        s._osc(35,n,n+.5,.1,'sine');
      }
      else if(t==='token'){
        s._osc(1100,n,n+.06,.05,'sine');
        s._osc(1650,n+.04,n+.1,.04,'sine');
        s._osc(2200,n+.08,n+.14,.03,'sine');
      }
      else if(t==='tick'){
        s._osc(900,n,n+.02,.03,'sine');
      }
      else if(t==='wind'){
        var w2=s._osc(200,n,n+.35,.03,'triangle');
        if(w2)w2.o.frequency.exponentialRampToValueAtTime(80,n+.35);
      }
    }catch(e){}
  },

  _osc:function(freq,start,stop,vol,type){
    if(!this.ctx)return null;
    var o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type=type||'sine';o.frequency.value=freq;
    o.connect(g);g.connect(this.sfxGain);
    g.gain.setValueAtTime(vol||.05,start);
    g.gain.exponentialRampToValueAtTime(.001,stop);
    o.start(start);o.stop(stop+.01);
    o.onended=function(){try{o.disconnect();g.disconnect()}catch(e){}};
    return{o:o,g:g};
  },
  _oscBg:function(freq,start,stop,vol,type){
    if(!this.ctx)return null;
    var o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type=type||'sine';o.frequency.value=freq;
    o.connect(g);g.connect(this.bgGain);
    g.gain.setValueAtTime(vol||.05,start);
    g.gain.exponentialRampToValueAtTime(.001,stop);
    o.start(start);o.stop(stop+.01);
    o.onended=function(){try{o.disconnect();g.disconnect()}catch(e){}};
    return{o:o,g:g};
  },

  toggleSound:function(){
    this.soundOn=!this.soundOn;
    if(this.ctx&&this.sfxGain)this.sfxGain.gain.linearRampToValueAtTime(this.soundOn?this.soundVol:0,this.ctx.currentTime+.1);
    return this.soundOn;
  },
  toggleMusic:function(){
    this.musicOn=!this.musicOn;
    if(!this._ready&&this.musicOn){this.init();this.res();this.startBG();return this.musicOn}
    if(this.ctx&&this.bgGain)this.bgGain.gain.linearRampToValueAtTime(this.musicOn?this.musicVol:0,this.ctx.currentTime+.8);
    if(!this.musicOn){
      if(this._chordI){clearInterval(this._chordI);this._chordI=null}
      if(this._bellI){clearInterval(this._bellI);this._bellI=null}
    }else if(this.bgOn){
      if(!this._chordI)this._startPadBreathing();
      if(!this._bellI)this._startBells();
    }
    return this.musicOn;
  },
  // === FREEFALL EXCITEMENT MUSIC ===
  _ffI:null,_ffNodes:[],_ffStep:0,
  startFreefall:function(){
    this.stopFreefall();
    if(!this.musicOn||!this._ready||!this.ctx)return;
    var self=this,c=this.ctx;
    // Exciting ascending arpeggio — gets faster as time goes on
    var scales=[
      [329.63,392,493.88,523.25,659.25,783.99,987.77,1046.5],  // E minor pentatonic high energy
      [349.23,440,523.25,659.25,698.46,880,1046.5,1318.5]       // F major bright
    ];
    var scaleIdx=0;this._ffStep=0;
    // Base pulse — heartbeat-like
    var pulse=c.createOscillator(),pulseG=c.createGain(),pulseLp=c.createBiquadFilter();
    pulse.type='sine';pulse.frequency.value=55;
    pulseLp.type='lowpass';pulseLp.frequency.value=100;pulseLp.Q.value=1;
    pulseG.gain.value=.04;
    pulse.connect(pulseLp);pulseLp.connect(pulseG);pulseG.connect(self.bgGain);pulse.start();
    self._ffNodes.push({o:pulse,g:pulseG});
    // Rhythmic arp
    this._ffI=setInterval(function(){
      if(!self.musicOn||!self.ctx)return;
      var n=c.currentTime;
      var scale=scales[scaleIdx%scales.length];
      var note=scale[self._ffStep%scale.length];
      var speed=Math.max(80,200-self._ffStep*3); // gets faster
      var vol=Math.min(.06,.025+self._ffStep*.001); // gets louder
      // FM bell tone
      var mod=c.createOscillator(),modG=c.createGain();
      mod.type='sine';mod.frequency.value=note*1.5;modG.gain.value=note*.3;
      var car=c.createOscillator(),carG=c.createGain();
      car.type='sine';car.frequency.value=note;
      mod.connect(modG);modG.connect(car.frequency);
      carG.gain.setValueAtTime(vol,n);
      carG.gain.exponentialRampToValueAtTime(.001,n+.3);
      modG.gain.exponentialRampToValueAtTime(.001,n+.15);
      car.connect(carG);carG.connect(self.bgGain);
      if(self._verb){carG.connect(self._verb)}
      mod.start(n);car.start(n);mod.stop(n+.4);car.stop(n+.4);
      car.onended=function(){try{mod.disconnect();modG.disconnect();car.disconnect();carG.disconnect()}catch(e){}};
      // Occasional octave jump for excitement
      if(self._ffStep%8===7){
        var high=note*2;
        var h=self._oscBg(high,n+.05,n+.2,vol*.6,'sine');
      }
      self._ffStep++;
      // Switch scale every 16 steps
      if(self._ffStep%16===0)scaleIdx++;
      // Pulse gets faster
      if(self._ffNodes[0]&&self._ffNodes[0].o.frequency){
        self._ffNodes[0].o.frequency.linearRampToValueAtTime(55+self._ffStep*.3,n+.2);
      }
    },180);
  },
  stopFreefall:function(){
    if(this._ffI){clearInterval(this._ffI);this._ffI=null}
    var n=this.ctx?this.ctx.currentTime:0;
    this._ffNodes.forEach(function(nd){
      try{nd.g.gain.linearRampToValueAtTime(0,n+.3);nd.o.stop(n+.4)}catch(e){}
    });
    this._ffNodes=[];this._ffStep=0;
  },
  setMood:function(){},
  toggle:function(){this.toggleSound();this.toggleMusic()}
};

// ======================== GAME STATE ========================
// ======================== LOCAL STORAGE HELPERS ========================
function _loadSaved(key,fallback){try{var v=localStorage.getItem('skydrop_'+key);return v!==null?JSON.parse(v):fallback}catch(e){return fallback}}
function _save(key,val){try{localStorage.setItem('skydrop_'+key,JSON.stringify(val))}catch(e){}}

var G={
  balance:_loadSaved('balance',1000),
  bets:[{amount:1,placed:false,out:false,cashMult:0},{amount:1,placed:false,out:false,cashMult:0}],
  phase:'INIT',phaseTimer:0,
  mult:1.0,crashPt:2.0,speed:0,
  alt:0,MAX_ALT:50000,roundNum:0,history:_loadSaved('history',[]),
  totR:_loadSaved('totR',0),totW:_loadSaved('totW',0),totWg:0,totP:_loadSaved('totP',0),bestC:_loadSaved('bestC',0),hiCr:_loadSaved('hiCr',0),betHistory:_loadSaved('betHistory',[]),
  rocket:{x:-60,y:-80,vx:35,vy:8,angle:0,curvePath:[],targetAlt:300},
  pilot:{x:0,y:0,vx:0,vy:0,chuteOpen:false,ejected:false,spin:0,ejectTime:0,seatFlame:0,_phase:'',_seatY:0,_bodyAngle:0,_drogueOpen:false,_canopyBlown:false},
  camera:{y:0,cx:-100,shake:0,zoom:1,zoomTarget:1,zoomX:0,zoomY:0},
  stars:[],particles:[],tokens:[],
  time:0,dt:0,lastFrame:0,lastMultFloor:0,
  autoBet:[false,false],autoCash:[false,false],
  _lastAltBand:-1
};

// ======================== AVATAR PICKER ========================
var AVATAR_PILOTS=['🧑‍✈️','👨‍✈️','👩‍✈️','🧑‍🚀','🪂','🏂','🪖','🏄'];
var AVATAR_ICONS=['💀','🔥','💎','⚡','🚀','👑','🎯','👾'];
var AVATAR_ANIMALS=['🦅','🐺','🦁','🐉','🦈','🦊','🐻','🦇'];
var AVATAR_COLORS=['#ff8800','#e53935','#8e24aa','#1e88e5','#00acc1','#43a047','#ffb300','#f4511e','#6d4c41','#546e7a','#d81b60','#5e35b1'];

var _selectedAvatar='🧑‍✈️';
var _selectedColor='#ff8800';
var _selectedName='Player';

function buildAvatarGrid(containerId,emojis){
  var grid=document.getElementById(containerId);grid.innerHTML='';
  emojis.forEach(function(em){
    var btn=document.createElement('div');
    btn.textContent=em;
    btn.style.cssText='width:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:24px;background:rgba(255,255,255,.04);border:2px solid transparent;border-radius:10px;cursor:pointer;transition:.2s';
    if(em===_selectedAvatar)btn.style.borderColor='var(--acc)';
    btn.onclick=function(){
      _selectedAvatar=em;
      document.getElementById('avatarPreview').textContent=em;
      document.querySelectorAll('#avatarGrid1 div,#avatarGrid2 div,#avatarGrid3 div').forEach(function(d){d.style.borderColor='transparent'});
      btn.style.borderColor='var(--acc)';
    };
    grid.appendChild(btn);
  });
}

function saveAvatar(){
  _selectedName=document.getElementById('avatarNameInput').value.trim()||'Player';
  document.getElementById('menuAvatarBtn').textContent=_selectedAvatar;
  document.getElementById('menuUserName').textContent=_selectedName;
  document.getElementById('avatarModal').classList.remove('open');
  try{sessionStorage.setItem('skydrop_avatar_set','1')}catch(e){}
}

function openAvatarModal(){
  buildAvatarGrid('avatarGrid1',AVATAR_PILOTS);
  buildAvatarGrid('avatarGrid2',AVATAR_ICONS);
  buildAvatarGrid('avatarGrid3',AVATAR_ANIMALS);
  document.getElementById('avatarPreview').textContent=_selectedAvatar;
  document.getElementById('avatarNameInput').value=_selectedName;
  document.getElementById('avatarModal').classList.add('open');
}

// ======================== CANVAS ========================
var cv=document.getElementById('c'),cx=cv.getContext('2d');
function resize(){cv.width=innerWidth;cv.height=innerHeight}
resize();addEventListener('resize',resize);
function w2s(wx,wy){var anchor=innerWidth<900?.3:.45;return{x:cv.width*.5-(G.camera.cx-wx),y:cv.height*anchor-(wy-G.camera.y)}}
function makeStars(){G.stars=[];for(var i=0;i<200;i++)G.stars.push({x:Math.random()*3000,y:Math.random()*2000,r:Math.random()*1.8+.2,ph:Math.random()*6.28,sp:Math.random()*.01+.003})}
makeStars();

// ======================== CRASH POINT ========================
function genCrash(){
  var r=Math.random();
  if(r<0.03)return 1.0;
  var cp=Math.floor(Math.max(1,0.97/r)*100)/100;
  return isFinite(cp)?cp:2.0;
}

// ======================== FAKE PLAYERS ========================
var _fakeSteps=[0.1,0.2,0.5,1,2,5,10,25,50,100];
function fakeBetAmt(){return _fakeSteps[Math.floor(Math.random()*_fakeSteps.length)].toFixed(2)}
var AVATARS=['🔴','🟠','🟡','🟢','🔵','🟣','⚪','🟤','💀','🎯','🔥','💎','🎮','👾','🛡️','⚡'];
var AVATAR_BGS=['#8b2233','#6b4422','#887722','#226633','#223388','#552277','#555','#553322','#333','#883322','#993311','#336688','#445566','#443366','#226655','#886622'];
function randomAvatar(){var i=Math.floor(Math.random()*AVATARS.length);return{emoji:AVATARS[i],bg:AVATAR_BGS[i]}}
function fakeFeed(m,w){
  try{
  var sb=document.getElementById('sbList');
  var id=Math.floor(Math.random()*9)+'***'+Math.floor(Math.random()*9);
  var bet=fakeBetAmt();
  var av=randomAvatar();
  var fakeWin=w?Math.min(10000,parseFloat(bet)*m).toFixed(2):'';
  var r2=document.createElement('div');r2.className='sb-row'+(w?' won':'');
  r2.innerHTML='<span class="sb-name"><span class="sb-av" style="background:'+av.bg+'">'+av.emoji+'</span>'+id+'</span><span class="sb-bet">'+bet+'</span><span class="sb-x">'+(w?m.toFixed(2)+'x':'')+'</span><span class="sb-win">'+fakeWin+'</span>';
  sb.insertBefore(r2,sb.firstChild);while(sb.children.length>40)sb.removeChild(sb.lastChild);
  G._sbBets=(G._sbBets||0)+1;G._sbWon=(G._sbWon||0)+(w?1:0);G._sbWinTotal=(G._sbWinTotal||0)+(w?parseFloat(fakeWin):0);
  document.getElementById('sbCount').textContent=G._sbWon+'/'+G._sbBets+' Bets';
  document.getElementById('sbWinTotal').textContent=G._sbWinTotal.toFixed(2);
  if(w&&m>=3){try{addTopWin(r2.querySelector('.sb-name').innerHTML,bet,m.toFixed(2)+'x',fakeWin)}catch(e2){}}
  syncMobileSb();
  }catch(e){}
}
function populateSidebar(){
  try{
  document.getElementById('sbList').innerHTML='';G._sbBets=0;G._sbWon=0;G._sbWinTotal=0;
  for(var i=0;i<12+Math.floor(Math.random()*12);i++){
    var av=randomAvatar();var id=Math.floor(Math.random()*9)+'***'+Math.floor(Math.random()*9);
    var bet=fakeBetAmt();
    var r2=document.createElement('div');r2.className='sb-row';
    r2.innerHTML='<span class="sb-name"><span class="sb-av" style="background:'+av.bg+'">'+av.emoji+'</span>'+id+'</span><span class="sb-bet">'+bet+'</span><span class="sb-x"></span><span class="sb-win"></span>';
    document.getElementById('sbList').appendChild(r2);G._sbBets++;
  }
  document.getElementById('sbCount').textContent='0/'+G._sbBets+' Bets';
  document.getElementById('sbWinTotal').textContent='0.00';
  var avEl=document.getElementById('sbAvatars');avEl.innerHTML='';
  for(var j=0;j<3;j++){var a=randomAvatar();var s=document.createElement('span');s.style.background=a.bg;s.textContent=a.emoji;avEl.appendChild(s)}
  syncMobileSb();
  }catch(e){}
}

// ======================== SIDEBAR TABS ========================
var _sbActiveTab=0;
function switchSbTab(idx){
  try{
  _sbActiveTab=idx;
  var tabs=document.querySelectorAll('.sb-tab');
  tabs.forEach(function(t,i){t.classList.toggle('active',i%3===idx)});
  for(var i=0;i<3;i++){
    var el=document.getElementById('sbTab'+i);if(el)el.style.display=i===idx?'':'none';
    var mel=document.getElementById('msbTab'+i);if(mel)mel.style.display=i===idx?'':'none';
  }
  }catch(e){}
}

// Sync desktop sidebar content to mobile sidebar
function syncMobileSb(){
  try{
    var pairs=[['sbList','msbList'],['prevList','msbPrevList'],['topList','msbTopList']];
    pairs.forEach(function(p){var src=document.getElementById(p[0]),dst=document.getElementById(p[1]);if(src&&dst)dst.innerHTML=src.innerHTML});
    var sync=[['sbCount','msbCount'],['sbWinTotal','msbWinTotal'],['prevCrash','msbPrevCrash'],['prevWinTotal','msbPrevWinTotal'],['topTotal','msbTopTotal']];
    sync.forEach(function(p){var s=document.getElementById(p[0]),d=document.getElementById(p[1]);if(s&&d){d.textContent=s.textContent;if(s.style.color)d.style.color=s.style.color}});
    var sAv=document.getElementById('sbAvatars'),dAv=document.getElementById('msbAvatars');
    if(sAv&&dAv)dAv.innerHTML=sAv.innerHTML;
  }catch(e){}
}

// Previous round data
var _prevRoundData=_loadSaved('prevRound',[]);
function savePrevRound(){
  try{
  _prevRoundData=[];
  var rows=document.getElementById('sbList').children;
  for(var i=0;i<rows.length;i++){
    var cells=rows[i].querySelectorAll('span');
    var name=cells[0]?cells[0].innerHTML:'';
    var bet=cells[1]?cells[1].textContent:'';
    var x=cells[2]?cells[2].textContent:'';
    var win=cells[3]?cells[3].textContent:'';
    _prevRoundData.push({name:name,bet:bet,x:x,win:win,won:rows[i].classList.contains('won')});
  }
  _save('prevRound',_prevRoundData);
  }catch(e){}
}
function populatePrevTab(){
  try{
  var list=document.getElementById('prevList');list.innerHTML='';
  var h0=G.history.length>0?G.history[0]:null;
  var prevCrash=h0?(typeof h0==='number'?h0:(h0.v||0)):null;
  document.getElementById('prevCrash').textContent=prevCrash?'Crashed @ '+prevCrash.toFixed(2)+'×':'—';
  document.getElementById('prevCrash').style.color=prevCrash&&prevCrash<2?'var(--dng)':prevCrash&&prevCrash>=5?'var(--acc)':'var(--wrn)';
  var totalWin=0;
  _prevRoundData.forEach(function(d){
    var r=document.createElement('div');r.className='sb-row'+(d.won?' won':'');
    r.innerHTML='<span class="sb-name">'+d.name+'</span><span class="sb-bet">'+d.bet+'</span><span class="sb-x">'+d.x+'</span><span class="sb-win">'+d.win+'</span>';
    list.appendChild(r);
    if(d.won&&d.win)totalWin+=parseFloat(d.win)||0;
  });
  document.getElementById('prevWinTotal').textContent=totalWin.toFixed(2);
  syncMobileSb();
  }catch(e){}
}

// Top wins (accumulated across session)
var _topWins=_loadSaved('topWins',[]);
function addTopWin(name,bet,mult,win){
  try{
  _topWins.push({name:name,bet:bet,mult:mult,win:win});
  _topWins.sort(function(a,b){return b.win-a.win});
  if(_topWins.length>20)_topWins.length=20;
  _save('topWins',_topWins);
  populateTopTab();
  }catch(e){}
}
function populateTopTab(){
  try{
  var list=document.getElementById('topList');list.innerHTML='';
  var total=0;
  _topWins.forEach(function(d){
    var r=document.createElement('div');r.className='sb-row won';
    r.innerHTML='<span class="sb-name">'+d.name+'</span><span class="sb-bet">'+d.bet+'</span><span class="sb-x" style="color:var(--gld)">'+d.mult+'</span><span class="sb-win" style="color:var(--gld)">'+d.win+'</span>';
    list.appendChild(r);
    total+=parseFloat(d.win)||0;
  });
  document.getElementById('topTotal').textContent=total.toFixed(2);
  syncMobileSb();
  }catch(e){}
}
// Seed initial top wins
(function(){
  for(var i=0;i<8;i++){
    var av=randomAvatar();
    var id=Math.floor(Math.random()*9)+'***'+Math.floor(Math.random()*9);
    var nm='<span class="sb-av" style="background:'+av.bg+'">'+av.emoji+'</span>'+id;
    var bt=fakeBetAmt();
    var ml=(2+Math.random()*30).toFixed(2);
    var wn=(parseFloat(bt)*parseFloat(ml)).toFixed(2);
    if(parseFloat(wn)>10000)wn='10000.00';
    _topWins.push({name:nm,bet:bt,mult:ml+'x',win:wn});
  }
  _topWins.sort(function(a,b){return parseFloat(b.win)-parseFloat(a.win)});
})();

// ======================== UI HELPERS ========================
function $(id){return document.getElementById(id)}
function updBal(){try{$('bal').textContent=G.balance.toFixed(2);_save('balance',G.balance)}catch(e){}}
function setSt(t,c){try{var e=$('stl');e.textContent=t;e.className='stl show '+c}catch(e){}}
function setCine(m,s,c){try{$('cineMain').textContent=m;$('cineSub').textContent=s||'';$('cine').className='cine show '+(c||'')}catch(e){}}
function hideCine(){try{$('cine').classList.remove('show')}catch(e){}}
function showAlert(t){try{var e=$('alrt');e.textContent=t;e.className='alrt show';setTimeout(function(){e.classList.remove('show')},2000)}catch(e){}}
function showBig(id,dur){try{var e=$(id);e.classList.add('show');setTimeout(function(){e.classList.remove('show')},dur||2500)}catch(e){}}
function addHist(v){try{
  var rnd=G.roundNum,pCount=G.fPlayers?G.fPlayers.length:0,tBet=0,myResult='—',myResultColor='var(--dim)';
  for(var i=0;i<2;i++){var b=G.bets[i];if(b.placed){if(b.out&&b.win>0){myResult='+$'+b.win.toFixed(2);myResultColor='var(--acc)'}else{myResult='-$'+b.amount.toFixed(2);myResultColor='var(--dng)'}}}
  if(G.fPlayers)for(var j=0;j<G.fPlayers.length;j++)tBet+=parseFloat(G.fPlayers[j].bet)||0;
  var timeStr=new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  var srvSeed=_rndSeed()+'VabC10zYMe2Z6DZ5rSaEqnwEd';
  var hash=_rndHex(128);
  var pNames=G.fPlayers?G.fPlayers.slice(0,3).map(function(p){return p.name||'Player'}):[];
  G.history.unshift({v:v,round:rnd,players:pCount,totalBet:tBet,result:myResult,resultColor:myResultColor,time:timeStr,serverSeed:srvSeed,hash:hash,playerNames:pNames});
  if(G.history.length>16)G.history.pop();
  _save('history',G.history);
  _save('totR',G.totR);_save('totW',G.totW);_save('totP',G.totP);_save('bestC',G.bestC);_save('hiCr',G.hiCr);_save('betHistory',G.betHistory);
  var e=$('hs'),c=v>=5?'g':v>=1.5?'y':'r',d=document.createElement('div');d.className='hc '+c;d.textContent=v.toFixed(2)+'×';d.style.cursor='pointer';
  d.onclick=(function(info){return function(){showRoundInfo(info)}})(G.history[0]);
  e.insertBefore(d,e.firstChild);while(e.children.length>16)e.removeChild(e.lastChild)
}catch(e){}}
function _rndHex(len){for(var s='',c='0123456789abcdef',i=0;i<len;i++)s+=c[Math.floor(Math.random()*16)];return s}
function _rndSeed(){for(var s='',c='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',i=0;i<20;i++)s+=c[Math.floor(Math.random()*c.length)];return s}
function _maskName(n){if(!n||n.length<3)return '***';return n[0]+'***'+n[n.length-1]}
function showRoundInfo(info){
  var v=info.v;
  // Header
  $('riRound').textContent=info.round;
  var badge=$('riCrashBadge');badge.textContent=v.toFixed(2)+'x';
  badge.style.background=v>=5?'rgba(76,175,80,.15)':v>=1.5?'rgba(255,170,0,.12)':'rgba(255,34,85,.12)';
  badge.style.color=v>=5?'var(--acc)':v>=1.5?'var(--wrn)':'var(--dng)';
  $('riTime').textContent=info.time||new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  // Server seed
  $('riServerSeed').textContent=info.serverSeed||_rndSeed()+'VabC10zYMe2Z6DZ5rSaEqnwEd';
  // Client seeds
  var csDiv=$('riClientSeeds');csDiv.innerHTML='';
  var pNames=info.playerNames||[];
  var seedCount=Math.min(info.players||3,3);
  for(var i=0;i<seedCount;i++){
    var row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:rgba(0,0,0,.2);border-radius:6px';
    var name=pNames[i]||('Player'+(i+1));
    row.innerHTML='<div style="display:flex;align-items:center;gap:6px"><span style="font-size:10px;color:var(--dim)">Player N'+(i+1)+':</span><span style="font-size:11px">'+(['🧑‍✈️','👾','🦅'])[i%3]+'</span><span style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;color:var(--txt)">'+_maskName(name)+'</span></div><div style="font-size:10px;color:var(--dim)">Seed: <span style="color:var(--txt);font-family:JetBrains Mono,monospace">'+_rndSeed()+'</span></div>';
    csDiv.appendChild(row);
  }
  // Hash
  var hash=info.hash||_rndHex(128);
  $('riHash').textContent=hash;
  // Hex / Decimal / Result
  var hex=hash.substring(0,12);
  var dec=parseInt(hex,16);
  $('riHex').textContent=hex;
  $('riDecimal').textContent=dec.toString();
  var rv=$('riResultVal');rv.textContent=v.toFixed(2);
  rv.style.color=v>=5?'var(--acc)':v>=1.5?'var(--wrn)':'var(--dng)';
  document.getElementById('roundInfoModal').classList.add('open');
}
function updAlt(){try{$('altN').textContent=Math.round(G.alt).toLocaleString();$('altF').style.height=(Math.min(1,G.alt/G.MAX_ALT)*100)+'%'}catch(e){}}
function updStats(){}
function spawnParticles(x,y,type,n){if(G.particles.length>300)return;for(var i=0;i<(n||20);i++){var a=Math.random()*Math.PI*2,s=Math.random()*7+2;G.particles.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-(type==='gold'?3:0),life:1,r:Math.random()*3+2,hue:type==='fire'?Math.random()*40+10:Math.random()*30+40,sat:100,lit:50+Math.random()*30})}}
function spawnToken(){if(G.tokens.length>25)return;var ty=G.pilot.y-(80+Math.random()*400),tx=G.pilot.x+(Math.random()-.5)*600;var bonusVals=[1.1,1.2,1.3,1.5,2.0,3.0,5.0,10.0],weights=[25,25,20,15,8,4,2,1],totalW=100;var r=Math.random()*totalW,dm=bonusVals[0];for(var i=0;i<weights.length;i++){r-=weights[i];if(r<=0){dm=bonusVals[i];break}}var c='#44ddaa',sz=12;if(dm>=10){c='#ffd700';sz=20}else if(dm>=5){c='#ff44aa';sz=18}else if(dm>=3){c='#ff6644';sz=16}else if(dm>=2){c='#ffaa00';sz=14}else if(dm>=1.5){c='#44ccff';sz=13}G.tokens.push({x:tx,y:ty,mult:dm,color:c,size:sz,pulse:Math.random()*6.28,collected:false,fadeOut:0})}
function showTokenPop(sx,sy,txt){try{var d=document.createElement('div');d.className='tkpop';d.textContent=txt;d.style.left=sx+'px';d.style.top=sy+'px';document.querySelector('.mid').appendChild(d);setTimeout(function(){d.remove()},900)}catch(e){}}

// ======================== BET CONTROLS ========================
var STEPS=[0.1,0.2,0.5,1,2,5,10,25,50,100];
function adj(s,d){if(G.bets[s-1].placed)return;var b=G.bets[s-1];var i=STEPS.indexOf(b.amount);if(i===-1){i=0;for(var j=0;j<STEPS.length;j++){if(STEPS[j]>=b.amount){i=j;break}}}i=Math.max(0,Math.min(STEPS.length-1,i+d));b.amount=STEPS[i];$('a'+s).textContent=b.amount.toFixed(2);updPanelBtn(s)}
function sa(s,v){if(G.bets[s-1].placed)return;v=Math.max(0.1,Math.min(100,v));G.bets[s-1].amount=v;$('a'+s).textContent=v.toFixed(2);updPanelBtn(s)}

function updPanelBtn(s){
  try{
  var b=G.bets[s-1],btn=$('btn'+s),lbl=btn.querySelector('.bb-label'),amt=btn.querySelector('.bb-amount');
  if(G.phase==='BETTING'){
    if(b.placed){btn.className='bp-betbtn cancel';lbl.textContent='Cancel';amt.textContent=b.amount.toFixed(2)+' USD'}
    else{btn.className='bp-betbtn';lbl.textContent='Bet';amt.textContent=b.amount.toFixed(2)+' USD'}
  }else if(G.phase==='FREEFALL'||(G.phase==='EXPLODE'&&G.pilot.ejected)){
    if(b.placed&&!b.out){btn.className='bp-betbtn cashout';lbl.textContent='Cash Out';amt.textContent=(b.amount*G.mult).toFixed(2)+' USD'}
    else if(b.placed&&b.out){btn.className='bp-betbtn won';lbl.textContent='Won!';amt.textContent='+'+(b.amount*b.cashMult).toFixed(2)+' USD'}
    else{btn.className='bp-betbtn waiting';lbl.textContent='Waiting';amt.textContent=''}
  }else{
    if(b.placed&&b.out){btn.className='bp-betbtn won';lbl.textContent='Won!';amt.textContent='+'+(b.amount*b.cashMult).toFixed(2)+' USD'}
    else{btn.className='bp-betbtn waiting';lbl.textContent='Next round';amt.textContent=''}
  }
  }catch(e){}
}
function updAllBtns(){updPanelBtn(1);updPanelBtn(2)}
function lockPanels(l){/* no longer locks panels - amount/auto always accessible */}

// ======================== BET ACTION ========================
function betAction(s){
  try{
  sfx.res();var b=G.bets[s-1];if(!b)return;
  if(G.phase==='BETTING'){
    if(b.placed){G.balance+=b.amount;b.placed=false;G.totWg-=b.amount;updBal();updPanelBtn(s)}
    else{
      if(b.amount>G.balance){showAlert('💰 Insufficient balance');return}
      if(b.amount<0.1||b.amount>100||!isFinite(b.amount))return;
      G.balance-=b.amount;b.placed=true;b.out=false;b.cashMult=0;G.totWg+=b.amount;updBal();sfx.play('bet');updPanelBtn(s)}
  }else if(G.phase==='FREEFALL'||(G.phase==='EXPLODE'&&G.pilot.ejected&&G.mult>1)){
    if(!b.placed||b.out)return;
    b.out=true;b.cashMult=G.mult;
    var w=Math.min(10000,Math.max(0,b.amount*G.mult));
    G.balance+=w;G.totP+=w-b.amount;G.totW++;
    if(G.mult>G.bestC)G.bestC=G.mult;
    G.betHistory.unshift({round:G.roundNum,bet:b.amount,mult:G.mult,win:w,time:new Date()});
    if(G.betHistory.length>50)G.betHistory.pop();
    updBal();sfx.play('cashout');
    try{$('winAmt').textContent='+$'+w.toFixed(2)}catch(e){}
    spawnParticles(cv.width/2,cv.height/2,'gold',30);
    updPanelBtn(s);fakeFeed(G.mult,true);
  }
  }catch(e){}
}

function toggleAuto(s,type){try{if(type==='bet'){G.autoBet[s-1]=!G.autoBet[s-1];$('autoBet'+s).classList.toggle('on',G.autoBet[s-1])}else{G.autoCash[s-1]=!G.autoCash[s-1];$('autoCash'+s).classList.toggle('on',G.autoCash[s-1])}}catch(e){}}

function switchTab(s,tab){
  try{
    var panel=$('panel'+s);
    var tabs=panel.querySelectorAll('.bp-tab');
    var autoRow=$('autoRow'+s);
    if(tab==='bet'){
      tabs[0].classList.add('active');tabs[1].classList.remove('active');
      autoRow.style.display='none';
    }else{
      tabs[1].classList.add('active');tabs[0].classList.remove('active');
      autoRow.style.display='';
    }
  }catch(e){}
}

function hidePanel2(){
  try{
    $('panel2').classList.add('hidden');
    $('addPanel2').style.display='';
  }catch(e){}
}
function showPanel2(){
  try{
    $('panel2').classList.remove('hidden');
    $('addPanel2').style.display='none';
  }catch(e){}
}

// ======================== PHASE FUNCTIONS ========================
function startBettingPhase(){
  console.log('[SKYDROP] startBettingPhase called, current phase:', G.phase);
  // Line 1: set phase — NOTHING can prevent this
  G.phase='BETTING';
  G.phaseTimer=BET_TIME;
  G.roundNum++;
  G.mult=1;G.speed=0;G.alt=0;G.lastMultFloor=0;

  // Pick altitude
  var bands=[800,1500,2500,4000,6000,8000,12000];
  var bi=Math.floor(Math.random()*bands.length);
  var t=0;while(bi===G._lastAltBand&&t<10){bi=Math.floor(Math.random()*bands.length);t++}
  G._lastAltBand=bi;

  // Reset objects — rocket starts high, flies horizontally across
  var flyAlt=bands[bi]*(0.85+Math.random()*0.3);
  G.rocket={x:-60,y:-80,vx:35,vy:8,angle:0,curvePath:[],targetAlt:flyAlt};
  G.pilot={x:0,y:0,vx:0,vy:0,chuteOpen:false,ejected:false,spin:0,ejectTime:0,seatFlame:0,_phase:'',_seatY:0,_bodyAngle:0,_drogueOpen:false,_canopyBlown:false};
  G.camera={y:-80,cx:-60,shake:0,zoom:1,zoomTarget:1,zoomX:cv.width/2,zoomY:cv.height*.4};
  G.particles=[];G.tokens=[];
  G.bets[0].placed=false;G.bets[0].out=false;G.bets[0].cashMult=0;
  G.bets[1].placed=false;G.bets[1].out=false;G.bets[1].cashMult=0;
  G.crashPt=genCrash();

  // UI (each safe)
  try{updAlt()}catch(e){}
  try{updBal()}catch(e){}
  try{updAllBtns()}catch(e){}
  try{lockPanels(false)}catch(e){}
  try{hideCine()}catch(e){}
  try{$('rInfo').textContent='ROUND #'+G.roundNum}catch(e){}
  try{$('timerBar').style.width='100%';$('timerBar').classList.remove('urgent')}catch(e){}
  try{setSt('✈ PLACE BETS — '+Math.ceil(G.phaseTimer)+'s','s1')}catch(e){}
  try{populateSidebar()}catch(e){}
  try{sfx.stopFreefall();sfx.play('launch')}catch(e){}
  // Auto bet
  for(var i=0;i<2;i++){try{if(G.autoBet[i]&&G.bets[i].amount>=0.1&&G.bets[i].amount<=100&&G.bets[i].amount<=G.balance){G.balance-=G.bets[i].amount;G.bets[i].placed=true;G.totWg+=G.bets[i].amount;updBal();updPanelBtn(i+1)}}catch(e){}}
}

function startExplodePhase(){
  G.phase='EXPLODE';G.phaseTimer=0;
  try{lockPanels(true);setSt('🚀 BETS CLOSED','s2');setCine('3...','GET READY');G.camera.zoomTarget=1.6}catch(e){}
}

function startFreefallPhase(){
  G.phase='FREEFALL';G.phaseTimer=0;
  if(!G.mult||G.mult<1){G.mult=1.0;G.speed=0.002}
  G.lastMultFloor=Math.floor(G.mult);
  try{setSt('🪂 FREEFALL — CASH OUT ANYTIME!','s3');setCine(G.mult.toFixed(2)+'×','MULTIPLIER');G.camera.zoomTarget=0.95;updAllBtns();sfx.startFreefall()}catch(e){}
}

function startCrashPhase(){
  console.log('[SKYDROP] startCrashPhase called, phase:', G.phase);
  // Phase and timer already set by caller
  if(G.phase!=='CRASH'){G.phase='CRASH';G.phaseTimer=0}
  // Force pilot to exist
  if(!G.pilot.ejected){G.pilot.ejected=true;G.pilot.x=G.rocket.x||0;G.pilot.y=G.rocket.y||0;G.pilot.vx=0;G.pilot.vy=0;G.pilot.spin=0;G.pilot._phase='freefall'}
  G.pilot.chuteOpen=true;G.pilot.vy=Math.min(G.pilot.vy||0,20);
  try{sfx.stopFreefall();sfx.play('chute')}catch(e){}
  G.camera.shake=2;G.camera.zoomTarget=1.05;
  // Record losses
  for(var i=0;i<2;i++){if(G.bets[i].placed&&!G.bets[i].out){G.totP-=G.bets[i].amount;G.betHistory.unshift({round:G.roundNum,bet:G.bets[i].amount,mult:G.crashPt,win:0,time:new Date()});if(G.betHistory.length>50)G.betHistory.pop()}}
  // Fake loss feed
  for(var j=0;j<3+Math.floor(Math.random()*4);j++){(function(jj){setTimeout(function(){fakeFeed(0,false)},jj*80)})(j)}
  try{$('cineMain').textContent=G.crashPt.toFixed(2)+'×';$('cineSub').textContent='CHUTE OPENED';$('cine').className='cine show crashed dng';setSt('🪂 ROUND OVER — '+G.crashPt.toFixed(2)+'×','s4');updAllBtns()}catch(e){}
  G.totR++;if(G.crashPt>G.hiCr)G.hiCr=G.crashPt;
  try{addHist(G.crashPt)}catch(e){}
  try{savePrevRound();populatePrevTab()}catch(e){}
}

// ======================== PILOT PHYSICS ========================
function updatePilotPhysics(){
  if(!G.pilot.ejected||G.pilot.chuteOpen)return;
  G.pilot.ejectTime+=G.dt;var et=G.pilot.ejectTime;
  if(G.pilot._phase==='seat_fire'&&et>0.35)G.pilot._phase='seat_sep';
  if(G.pilot._phase==='seat_sep'&&et>0.8)G.pilot._phase='freefall';
  if(G.pilot._phase==='freefall'&&et>1.2)G.pilot._phase='drogue';
  var ph=G.pilot._phase;
  if(ph==='seat_fire'){G.pilot.vy-=G.dt*30;G.pilot.seatFlame=1-et*2;G.pilot.spin+=G.dt*4;G.pilot._bodyAngle+=(1-G.pilot._bodyAngle)*G.dt*8}
  else if(ph==='seat_sep'){G.pilot.seatFlame=0;G.pilot._seatY+=(et-.35)*200*G.dt;G.pilot.spin+=G.dt*(6-et*3);G.pilot._bodyAngle+=(.7-G.pilot._bodyAngle)*G.dt*5}
  else if(ph==='freefall'){var sd=Math.max(.3,1-((et-.8)/.4)*.7);G.pilot.spin+=G.dt*3*sd;G.pilot._bodyAngle+=(0-G.pilot._bodyAngle)*G.dt*3}
  else if(ph==='drogue'){if(!G.pilot._drogueOpen){G.pilot._drogueOpen=true;G.camera.shake=1;sfx.play('wind')}G.pilot.vy*=(1-G.dt*1.2);G.pilot.spin*=(1-G.dt*4);G.pilot._bodyAngle+=(0-G.pilot._bodyAngle)*G.dt*6}
  G.pilot.vy-=G.dt*40;G.pilot.vx*=(1-G.dt*(ph==='drogue'?3:.5));
  G.pilot.y+=G.pilot.vy*G.dt;G.pilot.x+=G.pilot.vx*G.dt;
  var ws=ph==='drogue'?.3:ph==='freefall'?2:.5;
  G.pilot.x+=Math.sin(G.time*5)*ws*G.dt*60;
  if(ph==='seat_fire'&&Math.random()<.9){var ps=w2s(G.pilot.x,G.pilot.y);for(var i2=0;i2<2;i2++)G.particles.push({x:ps.x+(Math.random()-.5)*6,y:ps.y+18,vx:(Math.random()-.5)*4,vy:Math.random()*5+3,life:.5,r:2+Math.random()*3,hue:15+Math.random()*25,sat:100,lit:55+Math.random()*20})}
  if(Math.random()<.3){var ps2=w2s(G.pilot.x,G.pilot.y);G.particles.push({x:ps2.x+(Math.random()-.5)*8,y:ps2.y+10,vx:(Math.random()-.5)*1.5,vy:Math.random()*2+1,life:.8,r:1.5+Math.random()*2,hue:0,sat:0,lit:50+Math.random()*20})}
}

// ======================== UPDATE LOOP ========================
function update(ts){
  // RAF always at end — game loop NEVER dies
  try{
    if(!G.lastFrame)G.lastFrame=ts;
    G.dt=Math.min((ts-G.lastFrame)/1000,.05);G.lastFrame=ts;G.time+=G.dt;
    if(!isFinite(G.dt))G.dt=.016;
    if(!isFinite(G.mult))G.mult=1;

    // === BETTING ===
    if(G.phase==='BETTING'){
      G.phaseTimer-=G.dt;
      var pct=G.phaseTimer/BET_TIME;
      try{$('timerBar').style.width=(pct*100)+'%';$('timerBar').classList.toggle('urgent',pct<.4)}catch(e){}
      setSt('✈ PLACE BETS — '+Math.ceil(Math.max(0,G.phaseTimer))+'s','s1');
      var p=(BET_TIME-G.phaseTimer)/BET_TIME,thrust,turnAngle;
      if(p<0.15){thrust=50+p*180;turnAngle=Math.PI*.47-p*0.7}
      else if(p<0.5){var tp=(p-0.15)/0.35;thrust=80+tp*120;turnAngle=Math.PI*.4-tp*0.35}
      else{var tp2=(p-0.5)/0.5;thrust=140+tp2*80;turnAngle=Math.PI*.3-tp2*0.08}
      G.rocket.vx+=Math.cos(turnAngle)*thrust*G.dt;G.rocket.vy+=Math.sin(turnAngle)*thrust*G.dt;
      G.rocket.vx*=(1-G.dt*0.25);G.rocket.vy*=(1-G.dt*0.25);
      G.rocket.x+=G.rocket.vx*G.dt;G.rocket.y+=G.rocket.vy*G.dt;
      G.rocket.angle+=(Math.atan2(G.rocket.vy,G.rocket.vx)-G.rocket.angle)*G.dt*5;
      if(G.rocket.curvePath.length===0||Math.hypot(G.rocket.x-G.rocket.curvePath[G.rocket.curvePath.length-1].x,G.rocket.y-G.rocket.curvePath[G.rocket.curvePath.length-1].y)>1.5){G.rocket.curvePath.push({x:G.rocket.x,y:G.rocket.y});if(G.rocket.curvePath.length>120)G.rocket.curvePath.shift()}
      G.alt=Math.max(0,G.rocket.y*10);updAlt();
      G.camera.cx+=(G.rocket.x+G.rocket.vx*.3-G.camera.cx)*.06;G.camera.y+=(G.rocket.y+G.rocket.vy*.3-G.camera.y)*.06;
      // Zoom in on rocket during launch — gentle
      var launchZoom=1.15-p*.1;
      G.camera.zoomTarget=launchZoom;
      if(G.phaseTimer<=0)startExplodePhase();
    }

    // === EXPLODE ===
    else if(G.phase==='EXPLODE'){
      G.phaseTimer+=G.dt;
      G.rocket.x+=G.rocket.vx*G.dt;G.rocket.y+=G.rocket.vy*G.dt;
      G.rocket.angle=Math.atan2(G.rocket.vy,G.rocket.vx);
      if(G.rocket.curvePath.length===0||Math.hypot(G.rocket.x-G.rocket.curvePath[G.rocket.curvePath.length-1].x,G.rocket.y-G.rocket.curvePath[G.rocket.curvePath.length-1].y)>2){G.rocket.curvePath.push({x:G.rocket.x,y:G.rocket.y});if(G.rocket.curvePath.length>100)G.rocket.curvePath.shift()}
      if(!G.pilot.ejected&&G.phaseTimer>=0.6){
        G.pilot.ejected=true;G.pilot.x=G.rocket.x;G.pilot.y=G.rocket.y;
        G.pilot.vy=-2;G.pilot.vx=-3+(Math.random()-.5)*3;
        G.pilot.spin=0;G.pilot.ejectTime=0;G.pilot.seatFlame=0;
        G.pilot._phase='freefall';G.pilot._seatY=0;G.pilot._bodyAngle=0;G.pilot._drogueOpen=false;G.pilot._canopyBlown=false;G.pilot.chuteOpen=false;
        G.mult=1.0;G.speed=0.002;G.lastMultFloor=0;
        sfx.play('jump');G.camera.shake=1.5;G.camera.zoomTarget=0.95;updAllBtns();
      }
      if(!G.pilot.ejected){
        G.camera.cx+=(G.rocket.x-G.camera.cx)*.08;G.camera.y+=(G.rocket.y-G.camera.y)*.08;
        G.camera.zoomTarget=1.15;
        var cd=3-Math.floor(G.phaseTimer/.2);if(cd>=1)setCine(cd+'...','GET READY');
        G.alt=Math.max(0,G.rocket.y*10);updAlt();
      }else{
        G.pilot.vy-=G.dt*25;G.pilot.y+=G.pilot.vy*G.dt;G.pilot.x+=G.pilot.vx*G.dt;G.pilot.x+=Math.sin(G.time*4)*G.dt*3;
        G.pilot.spin+=G.dt*1.2;G.pilot._bodyAngle+=(0-G.pilot._bodyAngle)*G.dt*3;
        G.mult+=G.speed*G.mult*G.dt*30;G.speed+=G.dt*0.000006*60;
        setCine(G.mult.toFixed(2)+'×','FREEFALL');
        try{$('cine').className='cine show'+(G.mult>=8?' gold':G.mult>=4?' wrn':'')}catch(e){}
        setSt('🪂 CASH OUT — '+G.mult.toFixed(2)+'×','s3');
        try{for(var i=0;i<2;i++){if(G.bets[i].placed&&!G.bets[i].out){$('btn'+(i+1)).querySelector('.bb-amount').textContent=(G.bets[i].amount*G.mult).toFixed(2)+' USD'}}}catch(e){}
        try{for(var j=0;j<2;j++){if(G.autoCash[j]&&G.bets[j].placed&&!G.bets[j].out){var ac=parseFloat($('au'+(j+1)).value);if(ac>0&&G.mult>=ac)betAction(j+1)}}}catch(e){}
        G.alt=Math.max(0,G.pilot.y*10);updAlt();
        G.camera.cx+=(G.pilot.x-G.camera.cx)*.1;
        G.camera.y+=(G.pilot.y-G.camera.y)*.1;
        if(G.mult>=G.crashPt){
          G.phase='CRASH';G.phaseTimer=0;
          try{startCrashPhase()}catch(e){console.log('[SKYDROP] crashPhase error:',e.message)}
        }
      }
      if(G.phaseTimer>=EXPLODE_TIME&&G.pilot.ejected&&G.phase==='EXPLODE')startFreefallPhase();
    }

    // === FREEFALL ===
    else if(G.phase==='FREEFALL'){
      G.phaseTimer+=G.dt;
      G.mult+=G.speed*G.mult*G.dt*30;G.speed+=G.dt*0.000006*60;
      G.rocket.x+=G.rocket.vx*G.dt;G.rocket.y+=G.rocket.vy*G.dt;
      updatePilotPhysics();
      // Pilot steers toward nearest token
      var nearTk=null,nearDist=Infinity;
      G.tokens.forEach(function(tk){if(tk.collected)return;var d=Math.hypot(G.pilot.x-tk.x,G.pilot.y-tk.y);if(d<nearDist){nearDist=d;nearTk=tk}});
      if(nearTk&&nearDist<500){
        var steerX=(nearTk.x-G.pilot.x)*G.dt*2.5;
        var steerY=(nearTk.y-G.pilot.y)*G.dt*.8;
        G.pilot.x+=steerX;G.pilot.y+=steerY*.3;
        G.pilot.vx+=(nearTk.x>G.pilot.x?1:-1)*G.dt*15;
      }
      G.alt=Math.max(0,G.pilot.y*10);updAlt();
      G.camera.y+=(G.pilot.y-G.camera.y)*.15;G.camera.cx+=(G.pilot.x-G.camera.cx)*.15;
      // Gradually return zoom to normal during freefall
      var ffZoom=0.95+Math.min(.05,G.phaseTimer*.02);
      G.camera.zoomTarget=ffZoom;
      setCine(G.mult.toFixed(2)+'×','FREEFALL');
      try{$('cine').className='cine show'+(G.mult>=8?' gold':G.mult>=4?' wrn':'')}catch(e){}
      setSt('🪂 CASH OUT — '+G.mult.toFixed(2)+'×','s3');
      try{for(var i=0;i<2;i++){if(G.bets[i].placed&&!G.bets[i].out){$('btn'+(i+1)).querySelector('.bb-amount').textContent=(G.bets[i].amount*G.mult).toFixed(2)+' USD'}}}catch(e){}
      try{for(var j=0;j<2;j++){if(G.autoCash[j]&&G.bets[j].placed&&!G.bets[j].out){var ac=parseFloat($('au'+(j+1)).value);if(ac>0&&G.mult>=ac)betAction(j+1)}}}catch(e){}
      if(Math.random()<G.dt*4)spawnToken();
      G.tokens.forEach(function(tk){if(tk.collected)return;var dx=Math.abs(G.pilot.x-tk.x),dy=G.pilot.y-tk.y;if(dy<50&&dy>-50&&dx<80){tk.collected=true;tk.fadeOut=1;sfx.play('token');var sp=w2s(tk.x,tk.y);spawnParticles(sp.x,sp.y,'gold',8);showTokenPop(sp.x-20,sp.y-20,'×'+tk.mult.toFixed(1));G.mult*=(1+(tk.mult-1)*.1)}});
      G.tokens=G.tokens.filter(function(tk){if(tk.collected){tk.fadeOut-=G.dt*3;return tk.fadeOut>0}var sy=w2s(tk.x,tk.y).y;return sy>-100&&sy<cv.height+200});
      if(Math.random()<G.dt*.15){showAlert(['💨 CROSSWIND','⚠ TURBULENCE','💨 WIND SHEAR'][Math.floor(Math.random()*3)]);sfx.play('wind');G.camera.shake=2}
      var mf=Math.floor(G.mult);if(mf>G.lastMultFloor&&mf>=2){sfx.play('tick');G.lastMultFloor=mf}
      if(Math.random()<.025)fakeFeed(G.mult*(.5+Math.random()*.6),true);
      if(G.mult>=G.crashPt){
        G.phase='CRASH';G.phaseTimer=0;
        try{startCrashPhase()}catch(e){console.log('[SKYDROP] crashPhase error:',e.message)}
      }
    }

    // === CRASH ===
    else if(G.phase==='CRASH'){
      G.phaseTimer+=G.dt;
      if(G.phaseTimer<0.1||G.phaseTimer>2.9)console.log('[SKYDROP] CRASH phase tick, timer:',G.phaseTimer.toFixed(2));
      if(G.pilot.ejected){G.pilot.y-=(15+G.phaseTimer)*G.dt;G.pilot.x+=Math.sin(G.time*1.5)*.4}
      G.alt=Math.max(0,(G.pilot.ejected?G.pilot.y:G.rocket.y)*10);updAlt();
      G.camera.y+=(G.pilot.y-G.camera.y)*.12;G.camera.cx+=(G.pilot.x-G.camera.cx)*.12;
      var rem=Math.max(0,Math.ceil(CRASH_WAIT-G.phaseTimer));
      if(G.phaseTimer>1.5)setSt('NEXT ROUND IN '+rem+'s','s5');
      if(G.phaseTimer>=CRASH_WAIT){
        console.log('[SKYDROP] CRASH->BETTING transition NOW');
        G.phase='BETTING';G.phaseTimer=BET_TIME;
        try{startBettingPhase()}catch(e){console.log('[SKYDROP] NEW ROUND ERROR:',e.message)}
        console.log('[SKYDROP] After transition, phase:', G.phase);
      }
    }

    // Zoom
    G.camera.zoom+=(G.camera.zoomTarget-G.camera.zoom)*G.dt*2.5;
    G.camera.zoomX+=(cv.width*.5-G.camera.zoomX)*.2;
    G.camera.zoomY+=((innerWidth<900?cv.height*.3:cv.height*.45)-G.camera.zoomY)*.2;
    G.camera.shake*=.94;
  }catch(e){console.error('Update:',e)}
  requestAnimationFrame(update);
}

function render(){
  try{
  const W=cv.width,H=cv.height;cx.save();
  if(G.camera.shake>.1)cx.translate((Math.random()-.5)*G.camera.shake,(Math.random()-.5)*G.camera.shake);
  if(G.camera.zoom!==1){const z=G.camera.zoom;cx.translate(G.camera.zoomX,G.camera.zoomY);cx.scale(z,z);cx.translate(-G.camera.zoomX,-G.camera.zoomY)}
  // Sky — deep space always
  const aP=Math.min(1,G.alt/G.MAX_ALT);
  const g=cx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'rgb(2,3,12)');g.addColorStop(.4,'rgb(5,8,22)');g.addColorStop(.7,'rgb(8,12,30)');g.addColorStop(1,'rgb(10,15,35)');
  cx.fillStyle=g;cx.fillRect(0,0,W,H);
  // Nebula glow
  const neb=cx.createRadialGradient(W*.3,H*.4,0,W*.3,H*.4,W*.5);
  neb.addColorStop(0,'rgba(40,20,80,.06)');neb.addColorStop(.5,'rgba(20,40,100,.03)');neb.addColorStop(1,'transparent');
  cx.fillStyle=neb;cx.fillRect(0,0,W,H);
  const neb2=cx.createRadialGradient(W*.75,H*.25,0,W*.75,H*.25,W*.4);
  neb2.addColorStop(0,'rgba(80,30,50,.04)');neb2.addColorStop(1,'transparent');
  cx.fillStyle=neb2;cx.fillRect(0,0,W,H);
  // Subtle vignette
  const vig=cx.createRadialGradient(W*.5,H*.5,W*.2,W*.5,H*.5,W*.8);
  vig.addColorStop(0,'transparent');vig.addColorStop(1,'rgba(0,0,0,.25)');
  cx.fillStyle=vig;cx.fillRect(0,0,W,H);
  // Stars — always visible
  G.stars.forEach(s=>{
    const tw=Math.sin(performance.now()*s.sp+s.ph)*.4+.6;
    const sy2=(s.y+G.camera.y*.003)%H;
    const screenY=((sy2%H)+H)%H;
    const screenX=s.x%W;
    if(s.r>1){
      cx.fillStyle=`rgba(150,180,255,${tw*.05})`;
      cx.beginPath();cx.arc(screenX,screenY,s.r*4,0,Math.PI*2);cx.fill();
    }
    const hue=200+s.ph*10;
    cx.fillStyle=`hsla(${hue},30%,85%,${tw*.5})`;
    cx.beginPath();cx.arc(screenX,screenY,s.r,0,Math.PI*2);cx.fill();
  });
  // Freefall wind particles — visible rushing streaks
  if(G.phase==='FREEFALL'||G.phase==='CRASH'){
    cx.globalAlpha=.15;cx.strokeStyle='rgba(180,210,255,.3)';cx.lineWidth=1.5;
    for(let i=0;i<15;i++){
      const wx=((i*173+G.time*20)%(W+100))-50;
      const wy=((i*197+G.time*120+G.camera.y*.02)%(H+100))-50;
      cx.beginPath();cx.moveTo(wx,wy);cx.lineTo(wx+Math.sin(i)*3,wy+8+Math.random()*6);cx.stroke();
    }
    cx.globalAlpha=1;
  }
  // EARTH PLANET — realistic blue marble, rocket launch point
  const gs=w2s(0,0);
  const earthRadius=W*.65;
  const earthCenterY=gs.y+earthRadius*.82;
  if(earthCenterY-earthRadius<H+500){
    cx.save();
    // Deep ocean base
    const oceanG=cx.createRadialGradient(W*.38,earthCenterY-earthRadius*.35,earthRadius*.1,W*.5,earthCenterY,earthRadius);
    oceanG.addColorStop(0,'#4a9ae8');oceanG.addColorStop(.12,'#3888d8');oceanG.addColorStop(.3,'#2670b8');
    oceanG.addColorStop(.5,'#1d5898');oceanG.addColorStop(.7,'#154078');oceanG.addColorStop(.88,'#0c2850');oceanG.addColorStop(1,'#040c1a');
    cx.fillStyle=oceanG;
    cx.beginPath();cx.arc(W*.5,earthCenterY,earthRadius,0,Math.PI*2);cx.fill();

    // Clip to earth sphere for details
    cx.save();
    cx.beginPath();cx.arc(W*.5,earthCenterY,earthRadius,0,Math.PI*2);cx.clip();

    // Continents — multi-layered for depth
    const cRot=G.time*.04;
    // Africa + Europe
    cx.fillStyle='#1a6830';cx.globalAlpha=.35;
    cx.beginPath();cx.ellipse(W*.52+Math.sin(cRot)*12,earthCenterY-earthRadius*.32,earthRadius*.08,earthRadius*.14,-.1,0,Math.PI*2);cx.fill();
    cx.beginPath();cx.ellipse(W*.5+Math.sin(cRot)*12,earthCenterY-earthRadius*.48,earthRadius*.06,earthRadius*.05,.2,0,Math.PI*2);cx.fill();
    // Asia
    cx.fillStyle='#1d7035';
    cx.beginPath();cx.ellipse(W*.6+Math.sin(cRot)*12,earthCenterY-earthRadius*.42,earthRadius*.14,earthRadius*.1,.15,0,Math.PI*2);cx.fill();
    // Americas
    cx.fillStyle='#1a6830';
    cx.beginPath();cx.ellipse(W*.35+Math.sin(cRot)*12,earthCenterY-earthRadius*.35,earthRadius*.05,earthRadius*.18,-.15,0,Math.PI*2);cx.fill();
    cx.beginPath();cx.ellipse(W*.33+Math.sin(cRot)*12,earthCenterY-earthRadius*.15,earthRadius*.04,earthRadius*.1,.1,0,Math.PI*2);cx.fill();
    // Australia
    cx.beginPath();cx.ellipse(W*.68+Math.sin(cRot)*12,earthCenterY-earthRadius*.12,earthRadius*.05,earthRadius*.03,.2,0,Math.PI*2);cx.fill();
    // Antarctica
    cx.fillStyle='#c8d8e0';cx.globalAlpha=.2;
    cx.beginPath();cx.ellipse(W*.5,earthCenterY+earthRadius*.38,earthRadius*.25,earthRadius*.06,0,0,Math.PI*2);cx.fill();

    // Desert/arid regions
    cx.fillStyle='#8a7a40';cx.globalAlpha=.12;
    cx.beginPath();cx.ellipse(W*.54+Math.sin(cRot)*12,earthCenterY-earthRadius*.35,earthRadius*.06,earthRadius*.03,.1,0,Math.PI*2);cx.fill();
    cx.beginPath();cx.ellipse(W*.62+Math.sin(cRot)*12,earthCenterY-earthRadius*.3,earthRadius*.04,earthRadius*.02,0,0,Math.PI*2);cx.fill();

    // Ocean depth variation
    cx.fillStyle='#0a2858';cx.globalAlpha=.08;
    cx.beginPath();cx.ellipse(W*.42,earthCenterY-earthRadius*.22,earthRadius*.12,earthRadius*.08,.5,0,Math.PI*2);cx.fill();
    cx.beginPath();cx.ellipse(W*.58,earthCenterY+earthRadius*.05,earthRadius*.15,earthRadius*.06,-.3,0,Math.PI*2);cx.fill();

    cx.globalAlpha=1;

    // Realistic cloud systems — swirling, layered
    cx.globalAlpha=.22;
    // Hurricane spiral
    cx.fillStyle='#fff';
    for(let a=0;a<12;a++){
      const ang=a*.5+G.time*.15;const spiralR=earthRadius*(.02+a*.008);
      const sx=W*.4+Math.sin(cRot)*12+Math.cos(ang)*spiralR;
      const sy=earthCenterY-earthRadius*.2+Math.sin(ang)*spiralR*.5;
      cx.beginPath();cx.ellipse(sx,sy,earthRadius*.025,earthRadius*.008,ang,0,Math.PI*2);cx.fill();
    }
    // Cloud bands
    for(let i=0;i<12;i++){
      const ct2=G.time*.12+i*.9;
      const ccy=earthCenterY-earthRadius*.55+i*earthRadius*.08;
      const ccx=W*.5+Math.sin(ct2+i*.7)*earthRadius*.18;
      const ccw=earthRadius*(.08+Math.sin(i*2.3+G.time*.1)*.06);
      const cch=earthRadius*(.012+Math.sin(i*1.7)*.004);
      cx.beginPath();cx.ellipse(ccx,ccy,ccw,cch,Math.sin(i*.8)*.2,0,Math.PI*2);cx.fill();
    }
    // Wispy high clouds
    cx.globalAlpha=.1;
    for(let i=0;i<6;i++){
      const wx=W*(.25+i*.1)+Math.sin(G.time*.08+i*2)*earthRadius*.05;
      const wy=earthCenterY-earthRadius*(.45-i*.05);
      cx.beginPath();cx.ellipse(wx,wy,earthRadius*.06,earthRadius*.003,Math.sin(i)*.4,0,Math.PI*2);cx.fill();
    }
    cx.globalAlpha=1;
    cx.restore(); // end clip

    // Atmosphere layers
    // Inner atmosphere — subtle blue
    const atmo1=cx.createRadialGradient(W*.5,earthCenterY,earthRadius*.95,W*.5,earthCenterY,earthRadius*1.03);
    atmo1.addColorStop(0,'transparent');atmo1.addColorStop(.3,'rgba(80,160,255,.06)');
    atmo1.addColorStop(.7,'rgba(100,180,255,.12)');atmo1.addColorStop(1,'rgba(80,150,220,.04)');
    cx.fillStyle=atmo1;cx.beginPath();cx.arc(W*.5,earthCenterY,earthRadius*1.03,0,Math.PI*2);cx.fill();
    // Outer atmosphere — bright rim glow
    const atmo2=cx.createRadialGradient(W*.5,earthCenterY,earthRadius*.98,W*.5,earthCenterY,earthRadius*1.12);
    atmo2.addColorStop(0,'transparent');atmo2.addColorStop(.5,'rgba(60,150,255,.05)');
    atmo2.addColorStop(.75,'rgba(100,200,255,.1)');atmo2.addColorStop(.9,'rgba(120,210,255,.06)');atmo2.addColorStop(1,'transparent');
    cx.fillStyle=atmo2;cx.beginPath();cx.arc(W*.5,earthCenterY,earthRadius*1.12,0,Math.PI*2);cx.fill();

    // Specular — sun reflection on ocean (top-left)
    const specG=cx.createRadialGradient(W*.36,earthCenterY-earthRadius*.5,0,W*.4,earthCenterY-earthRadius*.35,earthRadius*.25);
    specG.addColorStop(0,'rgba(200,230,255,.1)');specG.addColorStop(.4,'rgba(160,200,240,.04)');specG.addColorStop(1,'transparent');
    cx.fillStyle=specG;cx.beginPath();cx.arc(W*.38,earthCenterY-earthRadius*.42,earthRadius*.22,0,Math.PI*2);cx.fill();

    // Terminator shadow (right side — night)
    const termG=cx.createLinearGradient(W*.5+earthRadius*.3,0,W*.5+earthRadius,0);
    termG.addColorStop(0,'transparent');termG.addColorStop(.4,'rgba(0,0,10,.15)');termG.addColorStop(1,'rgba(0,0,5,.35)');
    cx.fillStyle=termG;
    cx.beginPath();cx.arc(W*.5,earthCenterY,earthRadius,0,Math.PI*2);cx.fill();

    cx.restore();
  }

  // =================== SOLAR SYSTEM PLANETS ===================
  // Moon — orbiting near Earth
  if(earthCenterY-earthRadius<H+300){
    const moonOrbit=earthRadius*.25;const moonAng=G.time*.12;
    const moonX=W*.5+Math.cos(moonAng)*moonOrbit*1.5;
    const moonY=earthCenterY-earthRadius*.9+Math.sin(moonAng)*moonOrbit*.6;
    const moonR=14;cx.save();
    const moonG=cx.createRadialGradient(moonX-3,moonY-3,0,moonX,moonY,moonR);
    moonG.addColorStop(0,'#d8d8d0');moonG.addColorStop(.35,'#c0c0b8');moonG.addColorStop(.65,'#989088');moonG.addColorStop(1,'#484440');
    cx.fillStyle=moonG;cx.beginPath();cx.arc(moonX,moonY,moonR,0,Math.PI*2);cx.fill();
    cx.beginPath();cx.arc(moonX,moonY,moonR,0,Math.PI*2);cx.clip();
    cx.fillStyle='rgba(0,0,0,.07)';
    cx.beginPath();cx.arc(moonX-4,moonY-2,4,0,Math.PI*2);cx.fill();
    cx.beginPath();cx.arc(moonX+3,moonY+3,2.5,0,Math.PI*2);cx.fill();
    cx.beginPath();cx.arc(moonX-1,moonY+5,2,0,Math.PI*2);cx.fill();
    cx.fillStyle='rgba(60,55,50,.08)';cx.beginPath();cx.ellipse(moonX-2,moonY+1,5,3.5,.2,0,Math.PI*2);cx.fill();
    cx.restore();
  }
  // Venus — bright yellowish, right side
  const mob=W<700;
  // Venus
  const venAng=G.time*.04;const venCx=mob?W*.78:W*.88,venCy=mob?H*.12:H*.6,venOrbX=W*.06,venOrbY=mob?H*.03:H*.12;
  const venX=venCx+Math.cos(venAng)*venOrbX,venY=venCy+Math.sin(venAng)*venOrbY,venR=mob?12:18;
  const venG=cx.createRadialGradient(venX-3,venY-3,1,venX,venY,venR);
  venG.addColorStop(0,'#f8f0d0');venG.addColorStop(.3,'#e8d8a8');venG.addColorStop(.6,'#d0b878');venG.addColorStop(.85,'#988050');venG.addColorStop(1,'#483818');
  cx.fillStyle=venG;cx.beginPath();cx.arc(venX,venY,venR,0,Math.PI*2);cx.fill();
  cx.fillStyle='rgba(240,220,160,.06)';cx.beginPath();cx.arc(venX,venY,venR*1.15,0,Math.PI*2);cx.fill();
  cx.save();cx.beginPath();cx.arc(venX,venY,venR,0,Math.PI*2);cx.clip();
  cx.globalAlpha=.08;cx.fillStyle='#f0e0b0';
  for(let i=0;i<4;i++){cx.beginPath();cx.ellipse(venX+Math.sin(i*1.5+G.time*.1)*5,venY-venR*.3+i*venR*.2,venR*.6,venR*.06,Math.sin(i)*.3,0,Math.PI*2);cx.fill()}
  cx.globalAlpha=1;cx.restore();
  // Mars — upper right
  const marsAng=G.time*.03;const marsCx=mob?W*.55:W*.72,marsCy=mob?H*.05:H*.22,marsOrbX=mob?W*.06:W*.1,marsOrbY=mob?H*.02:H*.08;
  const marsX=marsCx+Math.cos(marsAng)*marsOrbX,marsY=marsCy+Math.sin(marsAng)*marsOrbY,marsR=mob?14:22;
  cx.save();const marsG=cx.createRadialGradient(marsX-4,marsY-4,1,marsX,marsY,marsR);
  marsG.addColorStop(0,'#e8a070');marsG.addColorStop(.3,'#d48858');marsG.addColorStop(.6,'#b86840');marsG.addColorStop(.85,'#7a4025');marsG.addColorStop(1,'#3a1a0a');
  cx.fillStyle=marsG;cx.beginPath();cx.arc(marsX,marsY,marsR,0,Math.PI*2);cx.fill();
  cx.beginPath();cx.arc(marsX,marsY,marsR,0,Math.PI*2);cx.clip();
  cx.globalAlpha=.15;cx.fillStyle='#6a3018';cx.beginPath();cx.ellipse(marsX-5,marsY+3,7,3.5,.2,0,Math.PI*2);cx.fill();
  cx.fillStyle='#905838';cx.beginPath();cx.arc(marsX-2,marsY-1,3,0,Math.PI*2);cx.fill();
  cx.fillStyle='#d8d0c8';cx.globalAlpha=.25;cx.beginPath();cx.ellipse(marsX,marsY-marsR+4,marsR*.45,2.5,0,0,Math.PI*2);cx.fill();
  cx.globalAlpha=1;cx.restore();
  cx.fillStyle='rgba(200,120,60,.03)';cx.beginPath();cx.arc(marsX,marsY,marsR*1.08,0,Math.PI*2);cx.fill();
  // Jupiter — large, left
  const jupAng=G.time*.015;const jupCx=mob?W*.12:W*.1,jupCy=mob?H*.18:H*.42,jupOrbX=mob?W*.05:W*.08,jupOrbY=mob?H*.03:H*.1;
  const jupX=jupCx+Math.cos(jupAng)*jupOrbX,jupY=jupCy+Math.sin(jupAng)*jupOrbY,jupR=mob?24:40;
  cx.save();const jupG=cx.createRadialGradient(jupX-8,jupY-8,2,jupX,jupY,jupR);
  jupG.addColorStop(0,'#f0d8a0');jupG.addColorStop(.25,'#e0c080');jupG.addColorStop(.5,'#c8a060');jupG.addColorStop(.75,'#a08040');jupG.addColorStop(1,'#4a3018');
  cx.fillStyle=jupG;cx.beginPath();cx.arc(jupX,jupY,jupR,0,Math.PI*2);cx.fill();
  cx.beginPath();cx.arc(jupX,jupY,jupR,0,Math.PI*2);cx.clip();
  cx.globalAlpha=.2;const jupC=['#d8b070','#a07838','#c8a058','#907030','#d0a860','#886828','#c09848','#806020','#d8b870','#907838'];
  for(let i=0;i<10;i++){cx.fillStyle=jupC[i];cx.fillRect(jupX-jupR,jupY-jupR+i*jupR*.2+1,jupR*2,jupR*.09)}
  cx.globalAlpha=.4;cx.fillStyle='#c05030';cx.beginPath();cx.ellipse(jupX+jupR*.3,jupY+jupR*.12,jupR*.22,jupR*.12,.1,0,Math.PI*2);cx.fill();
  cx.fillStyle='#e07050';cx.beginPath();cx.ellipse(jupX+jupR*.28,jupY+jupR*.1,jupR*.11,jupR*.05,0,0,Math.PI*2);cx.fill();
  cx.globalAlpha=1;cx.restore();
  // Saturn — top-left with rings
  const satAng=G.time*.012;const satCx=mob?W*.3:W*.25,satCy=mob?H*.04:H*.14,satOrbX=mob?W*.06:W*.09,satOrbY=mob?H*.02:H*.06;
  const satX=satCx+Math.cos(satAng)*satOrbX,satY=satCy+Math.sin(satAng)*satOrbY,satR=mob?15:24;
  cx.save();const satG=cx.createRadialGradient(satX-4,satY-4,1,satX,satY,satR);
  satG.addColorStop(0,'#f0e0b0');satG.addColorStop(.3,'#dcc888');satG.addColorStop(.6,'#c8a860');satG.addColorStop(.85,'#8a7040');satG.addColorStop(1,'#4a3818');
  cx.fillStyle=satG;cx.beginPath();cx.arc(satX,satY,satR,0,Math.PI*2);cx.fill();
  cx.beginPath();cx.arc(satX,satY,satR,0,Math.PI*2);cx.clip();
  cx.globalAlpha=.12;for(let i=0;i<7;i++){cx.fillStyle=i%2===0?'#d0b870':'#a89050';cx.fillRect(satX-satR,satY-satR+i*satR*.28+2,satR*2,satR*.1)}
  cx.globalAlpha=1;cx.restore();
  cx.save();cx.globalAlpha=.35;cx.strokeStyle='rgba(200,180,130,.3)';cx.lineWidth=5;
  cx.beginPath();cx.ellipse(satX,satY,satR*2.8,satR*.55,.12,Math.PI*.02,Math.PI*.98);cx.stroke();
  cx.strokeStyle='rgba(180,160,110,.2)';cx.lineWidth=7;cx.beginPath();cx.ellipse(satX,satY,satR*2.3,satR*.45,.12,Math.PI*.02,Math.PI*.98);cx.stroke();
  cx.globalAlpha=.45;cx.strokeStyle='rgba(210,190,140,.4)';cx.lineWidth=5.5;
  cx.beginPath();cx.ellipse(satX,satY,satR*2.8,satR*.55,.12,Math.PI*1.02,Math.PI*1.98);cx.stroke();
  cx.strokeStyle='rgba(190,170,120,.25)';cx.lineWidth=8;cx.beginPath();cx.ellipse(satX,satY,satR*2.3,satR*.45,.12,Math.PI*1.02,Math.PI*1.98);cx.stroke();
  cx.strokeStyle='rgba(5,8,20,.12)';cx.lineWidth=1;cx.beginPath();cx.ellipse(satX,satY,satR*2.5,satR*.5,.12,0,Math.PI*2);cx.stroke();
  cx.globalAlpha=1;cx.restore();
  // Uranus — pale cyan, far right
  const uraAng=G.time*.008;const uraCx=mob?W*.88:W*.85,uraCy=mob?H*.22:H*.35,uraOrbX=mob?W*.04:W*.07,uraOrbY=mob?H*.02:H*.08;
  const uraX=uraCx+Math.cos(uraAng)*uraOrbX,uraY=uraCy+Math.sin(uraAng)*uraOrbY,uraR=mob?10:16;
  const uraG=cx.createRadialGradient(uraX-2,uraY-2,0,uraX,uraY,uraR);
  uraG.addColorStop(0,'#b8e8f0');uraG.addColorStop(.4,'#88c8d8');uraG.addColorStop(.7,'#5898a8');uraG.addColorStop(1,'#1a3840');
  cx.fillStyle=uraG;cx.beginPath();cx.arc(uraX,uraY,uraR,0,Math.PI*2);cx.fill();
  cx.strokeStyle='rgba(160,200,210,.15)';cx.lineWidth=1.5;cx.beginPath();cx.ellipse(uraX,uraY,uraR*1.8,uraR*1.6,Math.PI*.42,0,Math.PI*2);cx.stroke();
  // Neptune — deep blue, far left bottom
  const nepAng=G.time*.006;const nepCx=mob?W*.08:W*.15,nepCy=mob?H*.32:H*.7,nepOrbX=mob?W*.04:W*.08,nepOrbY=mob?H*.02:H*.07;
  const nepX=nepCx+Math.cos(nepAng)*nepOrbX,nepY=nepCy+Math.sin(nepAng)*nepOrbY,nepR=mob?10:15;
  const nepG=cx.createRadialGradient(nepX-2,nepY-2,0,nepX,nepY,nepR);
  nepG.addColorStop(0,'#6090e0');nepG.addColorStop(.4,'#4070c0');nepG.addColorStop(.7,'#2850a0');nepG.addColorStop(1,'#0a1838');
  cx.fillStyle=nepG;cx.beginPath();cx.arc(nepX,nepY,nepR,0,Math.PI*2);cx.fill();
  cx.save();cx.beginPath();cx.arc(nepX,nepY,nepR,0,Math.PI*2);cx.clip();
  cx.fillStyle='rgba(15,30,80,.2)';cx.beginPath();cx.ellipse(nepX+3,nepY-1,4,2.5,.1,0,Math.PI*2);cx.fill();cx.restore();
  // Mercury — small, bottom-right near sun
  const merAng=G.time*.055;const merCx=mob?W*.65:W*.92,merCy=mob?H*.35:H*.82,merOrbX=mob?W*.04:W*.06,merOrbY=mob?H*.02:H*.06;
  const merX=merCx+Math.cos(merAng)*merOrbX,merY=merCy+Math.sin(merAng)*merOrbY,merR=mob?7:10;
  const merG=cx.createRadialGradient(merX-1,merY-1,0,merX,merY,merR);
  merG.addColorStop(0,'#c0b8a8');merG.addColorStop(.5,'#989088');merG.addColorStop(1,'#383430');
  cx.fillStyle=merG;cx.beginPath();cx.arc(merX,merY,merR,0,Math.PI*2);cx.fill();
  cx.save();cx.beginPath();cx.arc(merX,merY,merR,0,Math.PI*2);cx.clip();
  cx.fillStyle='rgba(0,0,0,.08)';cx.beginPath();cx.arc(merX-2,merY-1,2,0,Math.PI*2);cx.fill();
  cx.beginPath();cx.arc(merX+2,merY+2,1.5,0,Math.PI*2);cx.fill();cx.restore();
  // Sun glow — distant, bottom-right
  const sunGlw=cx.createRadialGradient(W*1.05,H*1.05,0,W*1.05,H*1.05,W*.4);
  sunGlw.addColorStop(0,'rgba(255,220,100,.08)');sunGlw.addColorStop(.3,'rgba(255,180,60,.04)');sunGlw.addColorStop(.6,'rgba(255,140,30,.015)');sunGlw.addColorStop(1,'transparent');
  cx.fillStyle=sunGlw;cx.fillRect(0,0,W,H);

  // (launch pad removed — curve style replaces it)
  // === CLOUDS — parallax scrolling, rush up during freefall ===
  const cA=Math.max(.02,Math.min(.12,Math.max(0,1-aP)*.15));
  const isFalling=G.phase==='FREEFALL'||G.phase==='EXPLODE'&&G.pilot.ejected;
  const cloudScroll=G.camera.y*(isFalling?.05:.008);
  // Large fluffy clouds
  for(let i=0;i<10;i++){
    const sp=.005+i*.002;
    const sz=80+i*25+((i*17)%30);
    const cloudSpeed=isFalling?(15+i*5):(3+i);
    const cy2=((i*280+cloudScroll+G.time*cloudSpeed)%(H+500))-250;
    const cx2=((i*230+Math.sin(i*2.3+G.time*.08)*100)%(W+200))-100;
    const screenY=((cy2%(H+500))+(H+500))%(H+500)-250;
    // Cloud body — multiple overlapping ellipses for fluffy look
    cx.fillStyle=`rgba(200,215,240,${cA*(isFalling?1.5:1)})`;
    cx.beginPath();cx.ellipse(cx2,screenY,sz,16+i*3,0,0,Math.PI*2);cx.fill();
    cx.beginPath();cx.ellipse(cx2-sz*.3,screenY+4,sz*.6,12+i*2,.1,0,Math.PI*2);cx.fill();
    cx.beginPath();cx.ellipse(cx2+sz*.35,screenY+3,sz*.5,10+i*2,-.1,0,Math.PI*2);cx.fill();
    // Bright top highlight
    cx.fillStyle=`rgba(240,248,255,${cA*.4})`;
    cx.beginPath();cx.ellipse(cx2,screenY-5,sz*.7,8+i,0,0,Math.PI*2);cx.fill();
  }
  // Small wispy clouds (faster scroll for depth)
  for(let i=0;i<6;i++){
    const wispSpeed=isFalling?(20+i*6):(6+i*2);
    const cy3=((i*350+cloudScroll*1.5+G.time*wispSpeed)%(H+400))-200;
    const cx3=((i*310+170)%(W+100))-50;
    const screenY2=((cy3%(H+400))+(H+400))%(H+400)-200;
    cx.fillStyle=`rgba(180,200,230,${cA*.5})`;
    cx.beginPath();cx.ellipse(cx3,screenY2,50+i*15,6+i*2,Math.sin(i)*0.3,0,Math.PI*2);cx.fill();
  }
  // === SPEED LINES during freefall — rushing upward ===
  if(isFalling||G.phase==='FREEFALL'){
    const slAlpha=Math.min(.2,G.mult*.01);
    cx.strokeStyle=`rgba(180,210,255,${slAlpha})`;cx.lineWidth=1;
    for(let i=0;i<20;i++){
      const lx=((i*97+37)%W);
      const ly=((i*173+G.time*400+cloudScroll*50)%(H+300))-150;
      const screenLy=((ly%(H+300))+(H+300))%(H+300)-150;
      const len=15+Math.random()*25;
      cx.beginPath();cx.moveTo(lx,screenLy);cx.lineTo(lx,screenLy+len);cx.stroke();
    }
  }
  // === ROCKET — CINEMATIC ANIMATED FLIGHT ===
  const showRocket=G.phase==='BETTING'||G.phase==='EXPLODE'||G.phase==='FREEFALL'||G.phase==='CRASH';
  if(showRocket){
    const rs=w2s(G.rocket.x,G.rocket.y);
    const rsx=rs.x,rsy=rs.y;
    const spd=Math.hypot(G.rocket.vx||0,G.rocket.vy||0);
    const spdN=Math.min(1,spd/80); // normalized speed 0→1

    if(rsx>-300&&rsx<W+300&&rsy>-300&&rsy<H+300){
      const t=G.time;

      // === EXHAUST TRAIL — multi-layer smoke + fire ===
      cx.save();
      const trail=G.rocket.curvePath;
      const tLen=trail.length;
      // Layer 1: Wide smoke (fading gray)
      for(let i=Math.max(0,tLen-80);i<tLen-1;i++){
        const age=(tLen-1-i)/80;
        const tp=w2s(trail[i].x,trail[i].y);
        const spread=age*20+Math.sin(t*3+i*.2)*age*8;
        const sz=4+age*28;
        cx.fillStyle=`rgba(${140+age*60},${130+age*50},${120+age*40},${(1-age)*.08})`;
        cx.beginPath();cx.arc(tp.x+(Math.random()-.5)*spread,tp.y+(Math.random()-.5)*spread,sz,0,Math.PI*2);cx.fill();
      }
      // Layer 2: Hot exhaust core (orange→yellow)
      for(let i=Math.max(0,tLen-40);i<tLen-1;i++){
        const age=(tLen-1-i)/40;
        const tp=w2s(trail[i].x,trail[i].y);
        const spread=age*6;
        const sz=2+age*10;
        const heat=1-age;
        cx.fillStyle=`rgba(255,${Math.floor(180*heat+80*(1-heat))},${Math.floor(40*heat)},${(1-age)*.25})`;
        cx.beginPath();cx.arc(tp.x+(Math.random()-.5)*spread,tp.y+(Math.random()-.5)*spread,sz,0,Math.PI*2);cx.fill();
      }
      // Layer 3: Bright center streak
      if(tLen>5){
        cx.strokeStyle='rgba(255,220,120,.12)';cx.lineWidth=3;cx.lineCap='round';
        cx.beginPath();
        const s0=w2s(trail[Math.max(0,tLen-20)].x,trail[Math.max(0,tLen-20)].y);
        cx.moveTo(s0.x,s0.y);
        for(let i=Math.max(0,tLen-20);i<tLen;i++){const tp=w2s(trail[i].x,trail[i].y);cx.lineTo(tp.x,tp.y)}
        cx.stroke();
      }
      cx.restore();

      // === HEAT SHIMMER around rocket ===
      if(spdN>.2){
        cx.save();cx.globalAlpha=spdN*.06;
        for(let i=0;i<3;i++){
          const sx2=rsx+Math.sin(t*8+i*2.1)*(10+spdN*15);
          const sy2=rsy+Math.cos(t*6+i*1.7)*(8+spdN*12);
          cx.fillStyle='rgba(255,200,100,.3)';
          cx.beginPath();cx.arc(sx2,sy2,15+spdN*20+Math.sin(t*5+i)*5,0,Math.PI*2);cx.fill();
        }
        cx.globalAlpha=1;cx.restore();
      }

      // === SHOCKWAVE RINGS (at high speed) ===
      if(spdN>.5){
        cx.save();cx.translate(rsx,rsy);cx.rotate(-G.rocket.angle);
        cx.globalAlpha=(spdN-.5)*.15;
        for(let i=0;i<3;i++){
          const ringX=-40-i*25-Math.sin(t*10+i)*5;
          const ringR=12+i*6+Math.sin(t*8+i*2)*3;
          cx.strokeStyle='rgba(200,220,255,.3)';cx.lineWidth=1;
          cx.beginPath();cx.ellipse(ringX,0,4,ringR,0,0,Math.PI*2);cx.stroke();
        }
        cx.globalAlpha=1;cx.restore();
      }

      // === ROCKET BODY (with vibration at speed) ===
      const vib=spdN*1.2;
      const vibX=Math.sin(t*45)*vib;
      const vibY=Math.cos(t*38)*vib*.6;
      const sc=1.8;
      cx.save();cx.translate(rsx+vibX,rsy+vibY);cx.rotate(-G.rocket.angle);cx.scale(sc,sc);

      // === MULTI-LAYER ENGINE FLAME ===
      const ft=t*14;
      const flLen=25+spdN*35+Math.sin(ft)*8+Math.random()*5;
      const flW=6+spdN*5+Math.sin(ft*1.3)*2;

      // Outer flame (large, orange-red, turbulent)
      const flG=cx.createLinearGradient(-28,0,-28-flLen*1.2,0);
      flG.addColorStop(0,'rgba(255,160,30,.9)');flG.addColorStop(.2,'rgba(255,100,15,.7)');
      flG.addColorStop(.5,'rgba(220,40,5,.35)');flG.addColorStop(.8,'rgba(160,20,0,.1)');flG.addColorStop(1,'transparent');
      cx.fillStyle=flG;
      cx.beginPath();cx.moveTo(-28,-(flW+2));
      cx.bezierCurveTo(-28-flLen*.3,-(flW*.8+Math.sin(ft*2)*3),-28-flLen*.7,-(flW*.3+Math.sin(ft*3)*4),-28-flLen*1.2,(Math.random()-.5)*6);
      cx.bezierCurveTo(-28-flLen*.7,(flW*.3+Math.cos(ft*2.5)*4),-28-flLen*.3,(flW*.8+Math.cos(ft*1.8)*3),-28,(flW+2));
      cx.closePath();cx.fill();

      // Mid flame (bright orange-yellow)
      const flG2=cx.createLinearGradient(-28,0,-28-flLen*.8,0);
      flG2.addColorStop(0,'rgba(255,220,60,.95)');flG2.addColorStop(.3,'rgba(255,170,30,.7)');
      flG2.addColorStop(.6,'rgba(255,100,10,.3)');flG2.addColorStop(1,'transparent');
      cx.fillStyle=flG2;
      cx.beginPath();cx.moveTo(-28,-flW*.6);
      cx.bezierCurveTo(-28-flLen*.25,-(flW*.5+Math.sin(ft*3)*2),-28-flLen*.5,-(flW*.15),-28-flLen*.8,(Math.random()-.5)*3);
      cx.bezierCurveTo(-28-flLen*.5,(flW*.15),-28-flLen*.25,(flW*.5+Math.cos(ft*2.7)*2),-28,flW*.6);
      cx.closePath();cx.fill();

      // Inner core (white-hot)
      const flG3=cx.createLinearGradient(-28,0,-28-flLen*.45,0);
      flG3.addColorStop(0,'rgba(255,255,240,.95)');flG3.addColorStop(.4,'rgba(255,240,180,.6)');
      flG3.addColorStop(1,'rgba(255,200,80,0)');
      cx.fillStyle=flG3;
      cx.beginPath();cx.moveTo(-28,-flW*.25);
      cx.quadraticCurveTo(-28-flLen*.25,-(flW*.1),-28-flLen*.45,0);
      cx.quadraticCurveTo(-28-flLen*.25,(flW*.1),-28,flW*.25);
      cx.closePath();cx.fill();

      // Flame sparks flying off
      for(let i=0;i<6;i++){
        const spx=-30-Math.random()*flLen*.9;
        const spy=(Math.random()-.5)*flW*2;
        const spr=.5+Math.random()*1.5;
        cx.fillStyle=`rgba(255,${150+Math.floor(Math.random()*100)},${Math.floor(Math.random()*40)},.${5+Math.floor(Math.random()*4)})`;
        cx.beginPath();cx.arc(spx,spy,spr,0,Math.PI*2);cx.fill();
      }

      // === ENGINE GLOW ===
      const engGlow=cx.createRadialGradient(-30,0,2,-30,0,14);
      engGlow.addColorStop(0,'rgba(255,200,80,.4)');engGlow.addColorStop(.5,'rgba(255,120,30,.15)');engGlow.addColorStop(1,'transparent');
      cx.fillStyle=engGlow;cx.beginPath();cx.arc(-30,0,14,0,Math.PI*2);cx.fill();

      // === FUSELAGE ===
      const bodyG=cx.createLinearGradient(0,-10,0,10);
      bodyG.addColorStop(0,'#e8ecf4');bodyG.addColorStop(.2,'#d8dce8');bodyG.addColorStop(.45,'#f2f4fa');
      bodyG.addColorStop(.55,'#e0e2ec');bodyG.addColorStop(.8,'#b8bcc8');bodyG.addColorStop(1,'#9a9eaa');
      cx.fillStyle=bodyG;
      cx.beginPath();cx.moveTo(33,0);cx.quadraticCurveTo(29,-7.5,18,-8.5);cx.lineTo(-22,-7.5);cx.quadraticCurveTo(-28,-6.5,-30,-4.5);cx.lineTo(-30,4.5);cx.quadraticCurveTo(-28,6.5,-22,7.5);cx.lineTo(18,8.5);cx.quadraticCurveTo(29,7.5,33,0);cx.closePath();cx.fill();
      // Highlight stripe
      cx.fillStyle='rgba(255,255,255,.15)';cx.fillRect(-20,-8.5,42,2.5);
      // Shadow underside
      cx.fillStyle='rgba(0,0,0,.06)';cx.fillRect(-22,5,40,3);

      // === NOSE CONE (red, glossy) ===
      const noseG=cx.createLinearGradient(33,-5,33,5);
      noseG.addColorStop(0,'#ff3355');noseG.addColorStop(.5,'#ee2244');noseG.addColorStop(1,'#cc1133');
      cx.fillStyle=noseG;
      cx.beginPath();cx.moveTo(33,0);cx.quadraticCurveTo(31,-5.5,22,-6.5);cx.lineTo(22,6.5);cx.quadraticCurveTo(31,5.5,33,0);cx.closePath();cx.fill();
      // Nose highlight
      cx.fillStyle='rgba(255,255,255,.2)';
      cx.beginPath();cx.moveTo(32,-1);cx.quadraticCurveTo(30,-4,25,-5);cx.lineTo(25,-2);cx.quadraticCurveTo(30,-1.5,32,-1);cx.closePath();cx.fill();

      // === RED ACCENT BAND ===
      cx.fillStyle='#dd2244';cx.fillRect(-8,-9,4,18);
      cx.fillStyle='rgba(0,0,0,.08)';cx.fillRect(-8,-9,4,1);

      // === WINGS (swept, metallic) ===
      const wingG=cx.createLinearGradient(0,-8,0,-24);
      wingG.addColorStop(0,'#b0b4c0');wingG.addColorStop(.5,'#9498a8');wingG.addColorStop(1,'#787c8c');
      cx.fillStyle=wingG;
      cx.beginPath();cx.moveTo(6,-8.5);cx.lineTo(0,-23);cx.lineTo(-10,-25);cx.lineTo(-14,-23);cx.lineTo(-8,-8.5);cx.closePath();cx.fill();
      cx.beginPath();cx.moveTo(6,8.5);cx.lineTo(0,23);cx.lineTo(-10,25);cx.lineTo(-14,23);cx.lineTo(-8,8.5);cx.closePath();cx.fill();
      // Wing tip red
      cx.fillStyle='#ee2244';
      cx.beginPath();cx.moveTo(0,-23);cx.lineTo(-4,-25);cx.lineTo(-10,-25);cx.lineTo(-6,-23);cx.closePath();cx.fill();
      cx.beginPath();cx.moveTo(0,23);cx.lineTo(-4,25);cx.lineTo(-10,25);cx.lineTo(-6,23);cx.closePath();cx.fill();
      // Wing highlight
      cx.fillStyle='rgba(255,255,255,.08)';
      cx.beginPath();cx.moveTo(4,-9);cx.lineTo(-1,-20);cx.lineTo(-5,-20);cx.lineTo(-2,-9);cx.closePath();cx.fill();

      // === TAIL FINS ===
      cx.fillStyle='#cc2244';
      cx.beginPath();cx.moveTo(-24,-7.5);cx.lineTo(-33,-17);cx.lineTo(-37,-16);cx.lineTo(-30,-7.5);cx.closePath();cx.fill();
      cx.beginPath();cx.moveTo(-24,7.5);cx.lineTo(-33,17);cx.lineTo(-37,16);cx.lineTo(-30,7.5);cx.closePath();cx.fill();
      // Vertical stabilizer
      cx.fillStyle='#dd3355';
      cx.beginPath();cx.moveTo(-26,0);cx.lineTo(-35,-13);cx.lineTo(-37,-12);cx.lineTo(-28,0);cx.closePath();cx.fill();

      // === COCKPIT WINDOW (reflective) ===
      const cockG=cx.createRadialGradient(24,-1,0,24,-1,6);
      cockG.addColorStop(0,'rgba(160,230,255,.7)');cockG.addColorStop(.4,'rgba(80,170,240,.5)');
      cockG.addColorStop(.8,'rgba(30,100,180,.3)');cockG.addColorStop(1,'rgba(10,50,120,.1)');
      cx.fillStyle=cockG;cx.beginPath();cx.ellipse(24,-1,5.5,3.8,-.1,0,Math.PI*2);cx.fill();
      // Window frame
      cx.strokeStyle='rgba(200,220,240,.2)';cx.lineWidth=.5;
      cx.beginPath();cx.ellipse(24,-1,5.5,3.8,-.1,0,Math.PI*2);cx.stroke();
      // Window reflection
      cx.fillStyle='rgba(255,255,255,.25)';
      cx.beginPath();cx.ellipse(23,-2.5,2.5,1.5,-.2,0,Math.PI*2);cx.fill();

      // === ENGINE NOZZLE ===
      const nozG=cx.createLinearGradient(-28,0,-34,0);
      nozG.addColorStop(0,'#666');nozG.addColorStop(1,'#444');
      cx.fillStyle=nozG;
      cx.beginPath();cx.moveTo(-28,-5.5);cx.lineTo(-33,-7);cx.lineTo(-33,7);cx.lineTo(-28,5.5);cx.closePath();cx.fill();
      // Nozzle inner glow
      cx.fillStyle='rgba(255,150,50,.2)';
      cx.beginPath();cx.ellipse(-33,0,3,6,0,0,Math.PI*2);cx.fill();

      // === PANEL LINES ===
      cx.strokeStyle='rgba(0,0,0,.06)';cx.lineWidth=.4;
      cx.beginPath();cx.moveTo(16,-8.5);cx.lineTo(16,8.5);cx.stroke();
      cx.beginPath();cx.moveTo(-5,-8.5);cx.lineTo(-5,8.5);cx.stroke();
      cx.beginPath();cx.moveTo(-20,-7.5);cx.lineTo(-20,7.5);cx.stroke();

      cx.restore();

      // === SPEED STREAKS around rocket ===
      if(spdN>.3){
        cx.save();cx.globalAlpha=(spdN-.3)*.2;
        for(let i=0;i<8;i++){
          const sx2=rsx-20-Math.random()*60*spdN;
          const sy2=rsy+(Math.random()-.5)*80;
          const sl=8+Math.random()*20*spdN;
          cx.strokeStyle='rgba(200,220,255,.4)';cx.lineWidth=.5+Math.random();
          cx.beginPath();cx.moveTo(sx2,sy2);cx.lineTo(sx2-sl*Math.cos(G.rocket.angle),sy2+sl*Math.sin(G.rocket.angle));cx.stroke();
        }
        cx.globalAlpha=1;cx.restore();
      }
    }
  }
  // === TOKENS ===
  if(G.phase==='FREEFALL'||G.phase==='CRASH'){G.tokens.forEach(tk=>{const ts=w2s(tk.x,tk.y);if(ts.y<-80||ts.y>H+80)return;const alpha=tk.collected?tk.fadeOut:1;const pulse=1+Math.sin(G.time*4+tk.pulse)*.12;const r=tk.size*pulse;cx.globalAlpha=alpha*.3;const grd=cx.createRadialGradient(ts.x,ts.y,0,ts.x,ts.y,r*3);grd.addColorStop(0,tk.color);grd.addColorStop(1,'transparent');cx.fillStyle=grd;cx.beginPath();cx.arc(ts.x,ts.y,r*3,0,Math.PI*2);cx.fill();cx.globalAlpha=alpha;cx.fillStyle=tk.color;cx.beginPath();cx.arc(ts.x,ts.y,r,0,Math.PI*2);cx.fill();cx.fillStyle='rgba(255,255,255,.35)';cx.beginPath();cx.arc(ts.x-r*.2,ts.y-r*.25,r*.4,0,Math.PI*2);cx.fill();cx.strokeStyle=tk.color;cx.lineWidth=1.5;cx.globalAlpha=alpha*.4;cx.beginPath();cx.arc(ts.x,ts.y,r*1.6*pulse,0,Math.PI*2);cx.stroke();cx.globalAlpha=alpha;cx.fillStyle='#fff';cx.font=`800 ${tk.size>=16?13:11}px Oxanium`;cx.textAlign='center';cx.textBaseline='middle';cx.fillText('×'+tk.mult.toFixed(1),ts.x,ts.y);cx.globalAlpha=1})}
  // === PILOT ===
  if(G.pilot.ejected){
    const ps=w2s(G.pilot.x,G.pilot.y);
    if(G.pilot.chuteOpen){const glw=cx.createRadialGradient(ps.x,ps.y-20,0,ps.x,ps.y-20,80);glw.addColorStop(0,'rgba(255,100,50,.04)');glw.addColorStop(1,'transparent');cx.fillStyle=glw;cx.beginPath();cx.arc(ps.x,ps.y-20,80,0,Math.PI*2);cx.fill()}
    cx.save();cx.translate(ps.x,ps.y);
    var pilotScale=innerWidth<900?1.4:1.6;cx.scale(pilotScale,pilotScale);
    const crashed=false;const inEject=!G.pilot.chuteOpen&&!crashed;
    const et=G.pilot.ejectTime;const ba=G.pilot._bodyAngle||0;
    const sway=G.pilot.chuteOpen&&!crashed?Math.sin(G.time*2.2)*8+Math.sin(G.time*3.5)*3+Math.cos(G.time*1.3)*2:0;
    if(inEject)cx.rotate(G.pilot.spin);
    // Seat
    if(inEject&&(G.pilot._phase==='seat_fire'||G.pilot._phase==='seat_sep')){
      cx.save();cx.translate(0,G.pilot._seatY||0);const sa2=G.pilot._phase==='seat_sep'?Math.max(0,1-(et-.35)*2):1;cx.globalAlpha=sa2;
      cx.fillStyle='#3a3a3a';cx.fillRect(-10,4,20,8);cx.fillStyle='#4a4a4a';cx.fillRect(-9,-2,18,8);cx.fillStyle='#333';cx.fillRect(-3,12,6,6);cx.fillStyle='#555';cx.fillRect(-6,-8,12,8);
      cx.strokeStyle='#666';cx.lineWidth=1.5;cx.beginPath();cx.moveTo(-8,12);cx.lineTo(-8,12+G.pilot._seatY*.3);cx.stroke();cx.beginPath();cx.moveTo(8,12);cx.lineTo(8,12+G.pilot._seatY*.3);cx.stroke();
      if(G.pilot.seatFlame>.01){const fl=G.pilot.seatFlame*45+Math.random()*12;const fg=cx.createLinearGradient(0,18,0,18+fl);fg.addColorStop(0,'rgba(255,220,80,.95)');fg.addColorStop(.3,'rgba(255,120,20,.8)');fg.addColorStop(.7,'rgba(255,50,10,.4)');fg.addColorStop(1,'transparent');cx.fillStyle=fg;cx.beginPath();cx.moveTo(-5,18);cx.lineTo(5,18);cx.lineTo(3+Math.random()*4,18+fl);cx.lineTo(-3-Math.random()*4,18+fl);cx.closePath();cx.fill();cx.fillStyle='rgba(255,255,200,.6)';cx.beginPath();cx.moveTo(-2,18);cx.lineTo(2,18);cx.lineTo(1,18+fl*.5);cx.lineTo(-1,18+fl*.5);cx.closePath();cx.fill()}
      cx.globalAlpha=1;cx.restore();
    }
    // Drogue
    if(inEject&&G.pilot._drogueOpen){const dS=18+Math.sin(G.time*6)*2,dY=-30-Math.sin(G.time*4)*3;cx.fillStyle='rgba(255,140,40,.5)';cx.beginPath();cx.ellipse(Math.sin(G.time*5)*3,dY,dS,dS*.4,0,Math.PI,0);cx.fill();cx.strokeStyle='rgba(200,200,200,.3)';cx.lineWidth=.5;for(let i=-1;i<=1;i++){cx.beginPath();cx.moveTo(i*6,-5);cx.lineTo(Math.sin(G.time*5)*3+i*8,dY);cx.stroke()}}
    // Main parachute
    if(G.pilot.chuteOpen&&!crashed){
      const cW=50,cH=32,cY=-55;cx.fillStyle='rgba(0,0,0,.06)';cx.beginPath();cx.ellipse(sway*.5+2,cY+2,cW+1,cH+1,0,Math.PI,0);cx.fill();
      const cg=cx.createRadialGradient(sway*.5,cY-8,4,sway*.5,cY,cW);cg.addColorStop(0,'#ff8844');cg.addColorStop(.5,'#ff5522');cg.addColorStop(1,'#cc3311');
      cx.fillStyle=cg;cx.beginPath();cx.ellipse(sway*.5,cY,cW,cH,0,Math.PI,0);cx.fill();
      cx.fillStyle='rgba(255,255,255,.2)';for(let i=-2;i<=2;i++){cx.beginPath();cx.ellipse(sway*.5+i*18,cY,3,cH-2,0,Math.PI,0);cx.fill()}
      cx.strokeStyle='rgba(200,200,200,.3)';cx.lineWidth=.6;for(let i=-3;i<=3;i++){cx.beginPath();cx.moveTo(sway*.5+i*14,cY);cx.quadraticCurveTo(sway*.4+i*3,cY/2,sway*.3,-5);cx.stroke()}
    }
    // Body — DETAILED COSMONAUT
    const px=G.pilot.chuteOpen?sway*.3:0;
    if(inEject){const tuck=ba;
      // Jetpack / life support
      cx.fillStyle='#8a8a8a';
      cx.beginPath();cx.moveTo(px-7,0);cx.lineTo(px-8,-2);cx.lineTo(px-8,12);cx.lineTo(px-6,13);cx.lineTo(px-6,0);cx.closePath();cx.fill();
      cx.beginPath();cx.moveTo(px+7,0);cx.lineTo(px+8,-2);cx.lineTo(px+8,12);cx.lineTo(px+6,13);cx.lineTo(px+6,0);cx.closePath();cx.fill();
      cx.fillStyle='#666';cx.fillRect(px-7.5,2,2,4);cx.fillRect(px+5.5,2,2,4);
      // Jetpack thrusters (small blue glow when ejecting)
      if(et<2){cx.fillStyle=`rgba(80,180,255,${Math.max(0,.3-et*.15)})`;cx.beginPath();cx.arc(px-7,14,2+Math.random(),0,Math.PI*2);cx.fill();cx.beginPath();cx.arc(px+7,14,2+Math.random(),0,Math.PI*2);cx.fill()}
      // Suit torso — white with shading
      const bodyG=cx.createLinearGradient(px-6,-4,px+6,-4);bodyG.addColorStop(0,'#c8c8cc');bodyG.addColorStop(.3,'#e8e8ec');bodyG.addColorStop(.7,'#f0f0f4');bodyG.addColorStop(1,'#c0c0c4');
      cx.fillStyle=bodyG;
      cx.beginPath();cx.moveTo(px-6,-4);cx.lineTo(px-5,12);cx.lineTo(px+5,12);cx.lineTo(px+6,-4);cx.closePath();cx.fill();
      // Suit seams
      cx.strokeStyle='rgba(120,120,130,.3)';cx.lineWidth=.4;
      cx.beginPath();cx.moveTo(px,-4);cx.lineTo(px,12);cx.stroke();
      cx.beginPath();cx.moveTo(px-5,4);cx.lineTo(px+5,4);cx.stroke();
      // Chest display
      cx.fillStyle='rgba(0,0,0,.6)';cx.fillRect(px-3,-1,6,4);
      cx.fillStyle='#4caf50';cx.fillRect(px-2.5,0,2,1);cx.fillStyle='#ff5722';cx.fillRect(px+.5,0,2,1);
      cx.fillStyle='#2196f3';cx.fillRect(px-2.5,1.5,5,.5);
      // Shoulder pads
      cx.fillStyle='#d0d0d4';cx.beginPath();cx.ellipse(px-6,-3,3,2,-.2,0,Math.PI*2);cx.fill();
      cx.beginPath();cx.ellipse(px+6,-3,3,2,.2,0,Math.PI*2);cx.fill();
      // Helmet — spherical with gold visor
      cx.fillStyle='#e8e8ec';cx.beginPath();cx.arc(px,-11,10,0,Math.PI*2);cx.fill();
      // Helmet rim
      const helmG=cx.createLinearGradient(px-10,-11,px+10,-11);helmG.addColorStop(0,'#b0b0b4');helmG.addColorStop(.5,'#d8d8dc');helmG.addColorStop(1,'#a8a8ac');
      cx.strokeStyle=helmG;cx.lineWidth=1.5;cx.beginPath();cx.arc(px,-11,10,0,Math.PI*2);cx.stroke();
      // Gold visor — reflective
      const vg=cx.createLinearGradient(px-6,-17,px+6,-6);vg.addColorStop(0,'rgba(255,210,60,.9)');vg.addColorStop(.3,'rgba(255,180,40,.8)');vg.addColorStop(.6,'rgba(220,150,30,.75)');vg.addColorStop(1,'rgba(180,110,20,.65)');
      cx.fillStyle=vg;cx.beginPath();cx.arc(px,-10,7.5,-.2,Math.PI+.2);cx.fill();
      // Visor reflections
      cx.fillStyle='rgba(255,255,255,.35)';cx.beginPath();cx.ellipse(px-3,-13,2.5,1.5,.3,0,Math.PI*2);cx.fill();
      cx.fillStyle='rgba(255,255,255,.15)';cx.beginPath();cx.ellipse(px+2,-9,1.5,1,0,0,Math.PI*2);cx.fill();
      // Arms
      const as=(1-tuck),aw=Math.sin(G.time*8+et*5);
      cx.strokeStyle='#d8d8dc';cx.lineWidth=4;cx.lineCap='round';
      const la1=-7+(-14)*as,la2=-2+(-12)*as+aw*3*as;cx.beginPath();cx.moveTo(px-6,0);cx.lineTo(px+la1,la2);cx.stroke();
      const ra1=7+(14)*as,ra2=-2+(-12)*as-aw*3*as;cx.beginPath();cx.moveTo(px+6,0);cx.lineTo(px+ra1,ra2);cx.stroke();
      // Gloves — dark gray
      cx.fillStyle='#5a5a5e';cx.beginPath();cx.arc(px+la1,la2,3,0,Math.PI*2);cx.fill();cx.beginPath();cx.arc(px+ra1,ra2,3,0,Math.PI*2);cx.fill();
      // Legs
      cx.strokeStyle='#d8d8dc';cx.lineWidth=4.5;const ls=(1-tuck)*9,lb=tuck*(-9);
      cx.beginPath();cx.moveTo(px-3,12);cx.lineTo(px-3-ls,24+lb);cx.stroke();
      cx.beginPath();cx.moveTo(px+3,12);cx.lineTo(px+3+ls,24+lb);cx.stroke();
      // Boots — heavy, dark
      cx.fillStyle='#3a3a3e';
      cx.beginPath();cx.ellipse(px-3-ls,24+lb,3.5,2.5,.1,0,Math.PI*2);cx.fill();
      cx.beginPath();cx.ellipse(px+3+ls,24+lb,3.5,2.5,-.1,0,Math.PI*2);cx.fill();
    }
    else{
      // Parachute pose — cosmonaut
      // Jetpack
      cx.fillStyle=crashed?'#5a4a4a':'#8a8a8a';cx.fillRect(px-7,0,2.5,11);cx.fillRect(px+4.5,0,2.5,11);
      // Torso
      const bodyG2=cx.createLinearGradient(px-5,-3,px+5,-3);
      if(crashed){bodyG2.addColorStop(0,'#7a6a6a');bodyG2.addColorStop(.5,'#8a7a7a');bodyG2.addColorStop(1,'#6a5a5a')}
      else{bodyG2.addColorStop(0,'#c8c8cc');bodyG2.addColorStop(.5,'#e8e8ec');bodyG2.addColorStop(1,'#c0c0c4')}
      cx.fillStyle=bodyG2;
      cx.beginPath();cx.moveTo(px-5,-3);cx.lineTo(px-4,12);cx.lineTo(px+4,12);cx.lineTo(px+5,-3);cx.closePath();cx.fill();
      // Chest display
      if(!crashed){cx.fillStyle='rgba(0,0,0,.6)';cx.fillRect(px-2.5,0,5,3);cx.fillStyle='#4caf50';cx.fillRect(px-2,0.5,1.5,.8);cx.fillStyle='#ff5722';cx.fillRect(px+.5,0.5,1.5,.8)}
      // Helmet
      cx.fillStyle=crashed?'#8a7a6a':'#e8e8ec';cx.beginPath();cx.arc(px,-9,9,0,Math.PI*2);cx.fill();
      cx.strokeStyle=crashed?'rgba(100,80,60,.4)':'rgba(160,160,164,.6)';cx.lineWidth=1.2;cx.beginPath();cx.arc(px,-9,9,0,Math.PI*2);cx.stroke();
      // Visor
      const vg2=cx.createLinearGradient(px-5,-14,px+5,-5);
      if(crashed){vg2.addColorStop(0,'rgba(120,70,30,.5)');vg2.addColorStop(1,'rgba(80,50,20,.35)')}
      else{vg2.addColorStop(0,'rgba(255,210,60,.9)');vg2.addColorStop(.5,'rgba(255,180,40,.8)');vg2.addColorStop(1,'rgba(180,110,20,.65)')}
      cx.fillStyle=vg2;cx.beginPath();cx.arc(px,-8,6.5,-.2,Math.PI+.2);cx.fill();
      if(!crashed){cx.fillStyle='rgba(255,255,255,.3)';cx.beginPath();cx.ellipse(px-2,-11,2,1.2,.3,0,Math.PI*2);cx.fill()}
      // Legs
      cx.strokeStyle=crashed?'#7a6a6a':'#d8d8dc';cx.lineWidth=3.5;cx.lineCap='round';
      cx.beginPath();cx.moveTo(px-2,12);cx.lineTo(px-5,23);cx.stroke();
      cx.beginPath();cx.moveTo(px+2,12);cx.lineTo(px+5,23);cx.stroke();
      // Boots
      cx.fillStyle=crashed?'#4a3a3a':'#3a3a3e';
      cx.beginPath();cx.ellipse(px-5,23,3,2,.1,0,Math.PI*2);cx.fill();
      cx.beginPath();cx.ellipse(px+5,23,3,2,-.1,0,Math.PI*2);cx.fill();
      // Arms holding chute lines
      if(!crashed&&G.pilot.chuteOpen){cx.strokeStyle='#d8d8dc';cx.lineWidth=3;cx.lineCap='round';cx.beginPath();cx.moveTo(px-5,0);cx.lineTo(px-14,-12);cx.stroke();cx.beginPath();cx.moveTo(px+5,0);cx.lineTo(px+14,-12);cx.stroke();cx.fillStyle='#5a5a5e';cx.beginPath();cx.arc(px-14,-12,2.5,0,Math.PI*2);cx.fill();cx.beginPath();cx.arc(px+14,-12,2.5,0,Math.PI*2);cx.fill()}
    }
    // Wind streaks
    if(inEject&&et<1){cx.globalAlpha=.15*(1-et);cx.strokeStyle='rgba(200,220,255,.4)';cx.lineWidth=1;for(let i=0;i<5;i++){const wy=Math.random()*50-25,wx=Math.random()*40-20;cx.beginPath();cx.moveTo(px+wx,wy);cx.lineTo(px+wx,wy+15+Math.random()*15);cx.stroke()}cx.globalAlpha=1}
    cx.restore();
  }
  // Particles
  G.particles=G.particles.filter(p=>{p.x+=p.vx*G.dt*60;p.y+=p.vy*G.dt*60;p.vy+=G.dt*7;p.vx*=.998;p.life-=G.dt*1.1;if(p.life<=0)return false;const a=p.life*p.life;cx.beginPath();cx.arc(p.x,p.y,p.r*(.5+p.life*.5),0,Math.PI*2);cx.fillStyle=`hsla(${p.hue},${p.sat}%,${p.lit}%,${a})`;cx.fill();return true});
  // Vignette + grain
  const vig2=cx.createRadialGradient(W/2,H/2,H*.25,W/2,H/2,H*.95);vig2.addColorStop(0,'transparent');vig2.addColorStop(.7,'rgba(0,0,0,.15)');vig2.addColorStop(1,'rgba(0,0,0,.5)');cx.fillStyle=vig2;cx.fillRect(0,0,W,H);
  cx.globalAlpha=.015;for(let i=0;i<30;i++){cx.fillStyle=Math.random()>.5?'#fff':'#000';cx.fillRect(Math.random()*W,Math.random()*H,Math.random()*3+1,Math.random()*3+1)}cx.globalAlpha=1;
  cx.restore();
  }catch(e){console.error('Render error:',e);try{cx.restore()}catch(e2){}}
  requestAnimationFrame(render);
}

// === EVENTS ===
// Burger menu
const menuOverlay=document.getElementById('menuOverlay'),menuPanel=document.getElementById('menuPanel');
function openMenu(){menuOverlay.classList.add('open');menuPanel.classList.add('open')}
function closeMenu(){menuOverlay.classList.remove('open');menuPanel.classList.remove('open')}
document.getElementById('burgerBtn').onclick=openMenu;
document.getElementById('menuClose').onclick=closeMenu;
menuOverlay.onclick=closeMenu;
// Sound toggle in menu
document.getElementById('menuSound').onclick=()=>{const on=sfx.toggleSound();document.getElementById('soundToggle').classList.toggle('on',on)};
document.getElementById('menuMusic').onclick=()=>{const on=sfx.toggleMusic();document.getElementById('musicToggle').classList.toggle('on',on)};
// Menu items open modals
document.getElementById('menuHowToPlay').onclick=()=>{closeMenu();document.getElementById('infoModal').classList.add('open')};
document.getElementById('menuGameRules').onclick=()=>{closeMenu();document.getElementById('rulesModal').classList.add('open')};
document.getElementById('menuGameLimits').onclick=()=>{closeMenu();document.getElementById('limitsModal').classList.add('open')};
document.getElementById('menuTerms').onclick=()=>{closeMenu();document.getElementById('termsModal').classList.add('open')};
document.getElementById('menuBetHistory').onclick=()=>{
  closeMenu();
  // Populate history
  const list=document.getElementById('hstList');
  const empty=document.getElementById('hstEmpty');
  list.innerHTML='';
  if(G.betHistory.length===0){empty.style.display='block'}
  else{
    empty.style.display='none';
    let wins=0,losses=0;
    G.betHistory.forEach(h=>{
      const won=h.win>0;
      if(won)wins++;else losses++;
      const row=document.createElement('div');
      row.style.cssText='display:grid;grid-template-columns:28px auto 1fr 1fr 1fr;gap:0;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.03);font-size:11px;align-items:center';
      row.innerHTML=`<span style="width:22px;height:22px;border-radius:50%;background:rgba(76,175,80,.12);display:flex;align-items:center;justify-content:center;font-size:11px;margin-left:4px">${_selectedAvatar}</span>`+
        `<span style="padding:0 6px;color:var(--dim);font-family:'JetBrains Mono',monospace;font-size:10px">#${h.round}</span>`+
        `<span style="font-family:'JetBrains Mono',monospace;font-weight:600">$${h.bet.toFixed(2)}</span>`+
        `<span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:${h.mult<2?'var(--dng)':h.mult<5?'var(--wrn)':'var(--acc)'}">${h.mult.toFixed(2)}×</span>`+
        `<span style="text-align:right;padding-right:4px;font-family:'JetBrains Mono',monospace;font-weight:700;color:${won?'var(--acc)':'var(--dng)'}">${won?'+$'+h.win.toFixed(2):'-$'+h.bet.toFixed(2)}</span>`;
      list.appendChild(row);
    });
    document.getElementById('hstWins').textContent=wins;
    document.getElementById('hstLosses').textContent=losses;
    const prof=G.totP;
    const profEl=document.getElementById('hstProfit');
    profEl.textContent=(prof>=0?'+':'')+' $'+prof.toFixed(2);
    profEl.style.color=prof>=0?'var(--acc)':'var(--dng)';
  }
  document.getElementById('historyModal').classList.add('open');
};
document.querySelectorAll('.mo').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open')}));
document.addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();if(document.querySelector('.mo.open')||document.getElementById('avatarModal').classList.contains('open'))return;if(G.phase==='FREEFALL'||(G.phase==='EXPLODE'&&G.pilot.ejected))betAction(1);else if(G.phase==='BETTING')betAction(1)}});

// ======================== CHAT ========================
var CHAT_MSGS=[
  'gl everyone 🍀','lets gooo 🚀','ez win','cashout at 2x trust me',
  'who else lost last round 😭','this game is rigged lol','nah its fair check the hash',
  'just hit 10x 🔥🔥','playing safe today','all in','anyone here from turkey?',
  'gg','bruh i was 0.01 away','hold hold hold','i love this game',
  'parachute always opens early smh','3x and out','im up $200 today',
  'dont be greedy','rip my balance','nice one!','how do you guys cashout so fast',
  'autobet is the way','im scared to bet high','just vibes','1x gang 😂',
  'sky drop best game','who needs sleep when you have skydrop','send it 🚀',
  'bruh','lmaooo','chill round','that was close','im out gg',
  'any tips?','bet small win big','patience is key','wow that crash was brutal',
  'my heart cant take this','imagine hitting 100x','one more round then i sleep',
  'ok last round for real this time','nope still playing 😅','addicted ngl'
];
var _chatHistory=[];
function _chatTime(){var d=new Date();return d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0')}
function _addChatMsg(name,avatar,avatarBg,text,isMe){
  var msg={name:name,avatar:avatar,bg:avatarBg,text:text,time:_chatTime(),isMe:!!isMe};
  _chatHistory.push(msg);
  if(_chatHistory.length>80)_chatHistory.shift();
  _renderChat('chatMessages');
  _renderChat('mChatMessages');
}
function _renderChat(containerId){
  var el=document.getElementById(containerId);if(!el)return;
  var wasBottom=el.scrollHeight-el.scrollTop-el.clientHeight<40;
  el.innerHTML='';
  _chatHistory.forEach(function(m){
    var div=document.createElement('div');div.className='chat-msg';
    div.innerHTML='<div class="chat-av" style="background:'+m.bg+'">'+m.avatar+'</div>'+
      '<div class="chat-body"><div class="chat-name'+(m.isMe?' me':'')+'">'+m.name+'</div>'+
      '<div class="chat-text">'+(m.text.indexOf('__GIF__')===0?(m.text.slice(7).indexOf('http')===0?'<div class="chat-gif-msg"><img src="'+m.text.slice(7)+'" alt="GIF" loading="lazy"></div>':'<div class="chat-gif-msg">'+m.text.slice(7)+'</div>'):m.text.replace(/</g,'&lt;').replace(/>/g,'&gt;'))+'</div>'+
      '<div class="chat-time">'+m.time+'</div></div>';
    el.appendChild(div);
  });
  if(wasBottom)el.scrollTop=el.scrollHeight;
}
function toggleMobileChat(){
  var isDesktop=window.innerWidth>=900;
  if(isDesktop){
    var panel=document.getElementById('chatPanel');
    panel.classList.toggle('open');
    if(panel.classList.contains('open'))_renderChat('chatMessages');
  }else{
    var ov=document.getElementById('mobileChatOverlay');
    ov.classList.toggle('open');
    if(ov.classList.contains('open'))_renderChat('mChatMessages');
  }
}
function sendChat(){
  var inp=document.getElementById('chatInput');
  var mInp=document.getElementById('mChatInput');
  var text=(inp&&inp.value.trim())||(mInp&&mInp.value.trim())||'';
  if(!text)return;
  _addChatMsg(_selectedName,_selectedAvatar,'rgba(76,175,80,.12)',text,true);
  if(inp)inp.value='';
  if(mInp)mInp.value='';
  // Close any open pickers
  document.querySelectorAll('.chat-picker.open').forEach(function(p){p.classList.remove('open')});
}
// ======================== EMOJI & GIF PICKER ========================
// GIPHY Integration — get your FREE key at https://developers.giphy.com/dashboard/
var GIPHY_KEY='21pOlJ0A6HPx3V3aoQ1rmyYIhLZSw6Wd';
var _gifDebounce=null;
var _gifLoading=false;
var EMOJI_DATA={
  'Smileys':['😀','😂','🤣','😊','😎','🥳','😍','🤑','😭','😱','🤯','🥺','😤','🫣','😏','🤡','💀','👻','😈','🤝'],
  'Gestures':['👍','👎','👏','🙌','🤞','✌️','🤟','💪','👊','🫰','🫶','🙏','👋','🤙','💅','🖕'],
  'Objects':['🔥','💎','💰','💵','🎰','🎲','🃏','🏆','🎯','⚡','💣','🚀','🪂','✈️','💸','🎉','🎊','🍀'],
  'Animals':['🦅','🐺','🦁','🐉','🦈','🦊','🐻','🦇','🐍','🦂','🐊','🦍'],
  'Hearts':['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','❤️‍🔥','💝','💗']
};
var GIF_STICKERS=[
  {emoji:'🚀💨',label:'Launch'},
  {emoji:'💰🤑💰',label:'Money'},
  {emoji:'🔥🔥🔥',label:'Fire'},
  {emoji:'💎👐💎',label:'Diamond Hands'},
  {emoji:'🎉🥳🎊',label:'Party'},
  {emoji:'😭💔😭',label:'Cry'},
  {emoji:'🤯💥🤯',label:'Mind Blown'},
  {emoji:'👑✨👑',label:'King'},
  {emoji:'🪂⬇️💀',label:'Crash'},
  {emoji:'📈🟢📈',label:'Moon'},
  {emoji:'📉🔴📉',label:'Dump'},
  {emoji:'🍀🤞🍀',label:'Lucky'},
  {emoji:'💪😤💪',label:'Strong'},
  {emoji:'🐋💰🐋',label:'Whale'},
  {emoji:'⏰💣⏰',label:'Ticking'},
  {emoji:'🎰🎰🎰',label:'Jackpot'},
  {emoji:'👀👀👀',label:'Watching'},
  {emoji:'🫡🫡🫡',label:'Salute'}
];
var _pickerMode='emoji'; // 'emoji' or 'gif'
var _pickerTargets={'chatPicker':'chatInput','mChatPicker':'mChatInput'};

function togglePicker(pickerId,forceMode){
  var pk=document.getElementById(pickerId);
  if(pk.classList.contains('open')&&(!forceMode||forceMode===_pickerMode)){
    pk.classList.remove('open');return;
  }
  if(forceMode)_pickerMode=forceMode;
  else if(!pk.classList.contains('open'))_pickerMode='emoji';
  pk.classList.add('open');
  _updatePickerTabs(pickerId);
  _populatePicker(pickerId);
  // clear search
  var sId=pickerId==='chatPicker'?'pickerSearch':'mPickerSearch';
  var s=document.getElementById(sId);if(s)s.value='';
}
function switchPickerTab(mode,pickerId){
  pickerId=pickerId||'chatPicker';
  _pickerMode=mode;
  _updatePickerTabs(pickerId);
  _populatePicker(pickerId);
  var sId=pickerId==='chatPicker'?'pickerSearch':'mPickerSearch';
  var s=document.getElementById(sId);if(s)s.value='';
}
function _updatePickerTabs(pickerId){
  var pk=document.getElementById(pickerId);if(!pk)return;
  var tabs=pk.querySelectorAll('.picker-tab');
  tabs.forEach(function(t){t.classList.toggle('active',t.textContent.indexOf(_pickerMode==='gif'?'GIF':'Emoji')!==-1)});
}
function _populatePicker(pickerId,filter){
  var gridId=pickerId==='chatPicker'?'pickerGrid':'mPickerGrid';
  var grid=document.getElementById(gridId);if(!grid)return;
  grid.innerHTML='';
  filter=(filter||'').toLowerCase();
  if(_pickerMode==='emoji'){
    grid.classList.remove('gif-mode');
    Object.keys(EMOJI_DATA).forEach(function(cat){
      if(filter&&cat.toLowerCase().indexOf(filter)===-1){
        // check individual emojis... just show all if category doesn't match
        var emojis=EMOJI_DATA[cat];
        emojis.forEach(function(e){
          // no text filter for emojis, show all unless filter is set
        });
        if(filter)return; // skip non-matching categories when filtering
      }
      // Category label
      var lbl=document.createElement('div');
      lbl.style.cssText='grid-column:1/-1;font-size:9px;color:var(--dim);font-weight:700;letter-spacing:1px;padding:4px 0 2px;font-family:Oxanium,sans-serif';
      lbl.textContent=cat.toUpperCase();
      grid.appendChild(lbl);
      EMOJI_DATA[cat].forEach(function(em){
        var btn=document.createElement('button');btn.className='picker-item';btn.textContent=em;
        btn.onclick=function(){_insertEmoji(pickerId,em)};
        grid.appendChild(btn);
      });
    });
    if(!filter){return}
    // If filter active, re-populate showing all matching
    grid.innerHTML='';
    Object.keys(EMOJI_DATA).forEach(function(cat){
      EMOJI_DATA[cat].forEach(function(em){
        var btn=document.createElement('button');btn.className='picker-item';btn.textContent=em;
        btn.onclick=function(){_insertEmoji(pickerId,em)};
        grid.appendChild(btn);
      });
    });
  }else{
    grid.classList.add('gif-mode');
    if(GIPHY_KEY){
      _fetchGiphy(filter,pickerId);
    }else{
      // Fallback: emoji stickers when no API key
      GIF_STICKERS.forEach(function(g){
        if(filter&&g.label.toLowerCase().indexOf(filter)===-1)return;
        var btn=document.createElement('button');btn.className='picker-gif';
        btn.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;gap:2px"><span style="font-size:28px">'+g.emoji+'</span><span style="font-size:8px;color:var(--dim);letter-spacing:.5px">'+g.label+'</span></div>';
        btn.onclick=function(){_sendGif(pickerId,g.emoji)};
        grid.appendChild(btn);
      });
    }
  }
}
function _fetchGiphy(query,pickerId){
  var gridId=pickerId==='chatPicker'?'pickerGrid':'mPickerGrid';
  var grid=document.getElementById(gridId);if(!grid)return;
  _gifLoading=true;
  grid.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--dim);font-size:11px;padding:20px">Loading GIFs…</div>';
  var url=query
    ?'https://api.giphy.com/v1/gifs/search?api_key='+GIPHY_KEY+'&q='+encodeURIComponent(query)+'&limit=21&rating=g&lang=en'
    :'https://api.giphy.com/v1/gifs/trending?api_key='+GIPHY_KEY+'&limit=21&rating=g';
  fetch(url).then(function(r){return r.json()}).then(function(res){
    _gifLoading=false;grid.innerHTML='';
    if(!res.data||!res.data.length){
      grid.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--dim);font-size:11px;padding:20px">No GIFs found</div>';return;
    }
    res.data.forEach(function(gif){
      var btn=document.createElement('button');btn.className='picker-gif-real';
      var img=document.createElement('img');
      img.src=gif.images.fixed_width_small.url;
      img.alt=gif.title||'';img.loading='lazy';
      btn.appendChild(img);
      btn.onclick=function(){_sendGif(pickerId,gif.images.fixed_height.url)};
      grid.appendChild(btn);
    });
    // GIPHY attribution
    var attr=document.createElement('div');
    attr.style.cssText='grid-column:1/-1;text-align:center;padding:6px 0 2px;opacity:.4';
    attr.innerHTML='<img src="https://giphy.com/static/img/poweredby_giphy.png" alt="Powered by GIPHY" style="height:14px">';
    grid.appendChild(attr);
  }).catch(function(){
    _gifLoading=false;
    grid.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--dim);font-size:11px;padding:20px">Failed to load GIFs</div>';
  });
}
function filterPicker(pickerId){
  pickerId=pickerId||'chatPicker';
  var sId=pickerId==='chatPicker'?'pickerSearch':'mPickerSearch';
  var val=document.getElementById(sId).value;
  if(_pickerMode==='gif'&&GIPHY_KEY){
    clearTimeout(_gifDebounce);
    _gifDebounce=setTimeout(function(){_fetchGiphy(val,pickerId)},400);
  }else{
    _populatePicker(pickerId,val);
  }
}
function _insertEmoji(pickerId,emoji){
  var inputId=_pickerTargets[pickerId];
  var inp=document.getElementById(inputId);if(!inp)return;
  inp.value+=emoji;
  inp.focus();
}
function _sendGif(pickerId,gifData){
  document.getElementById(pickerId).classList.remove('open');
  _addChatMsg(_selectedName,_selectedAvatar,'rgba(76,175,80,.12)','__GIF__'+gifData,true);
}
// Init pickers on load
(function(){_populatePicker('chatPicker');_populatePicker('mChatPicker')})();

// Enter key to send
document.addEventListener('keydown',function(e){
  if(e.key==='Enter'&&(document.activeElement&&(document.activeElement.id==='chatInput'||document.activeElement.id==='mChatInput'))){
    e.preventDefault();sendChat();
  }
});
// Close mobile chat on overlay tap
document.getElementById('mobileChatOverlay').addEventListener('click',function(e){if(e.target===this)toggleMobileChat()});
// Fake chat messages from bots
var _chatBotInterval=setInterval(function(){
  if(Math.random()>.4)return;
  var av=randomAvatar();
  var id=Math.floor(Math.random()*9)+'***'+Math.floor(Math.random()*9);
  var msg;
  if(Math.random()<.15){var g=GIF_STICKERS[Math.floor(Math.random()*GIF_STICKERS.length)];msg='__GIF__'+g.emoji}
  else{msg=CHAT_MSGS[Math.floor(Math.random()*CHAT_MSGS.length)]}
  _addChatMsg(id,av.emoji,av.bg,msg,false);
},4000+Math.random()*3000);
// Seed a few initial messages
(function(){
  for(var i=0;i<5;i++){
    var av=randomAvatar();
    var id=Math.floor(Math.random()*9)+'***'+Math.floor(Math.random()*9);
    _chatHistory.push({name:id,avatar:av.emoji,bg:av.bg,text:CHAT_MSGS[Math.floor(Math.random()*CHAT_MSGS.length)],time:_chatTime(),isMe:false});
  }
  _renderChat('chatMessages');
  _renderChat('mChatMessages');
})();

// === START ===
// Restore saved history bar, or seed with defaults on first visit
(function(){
  if(G.history.length>0){
    // Restore history bar from saved data
    var e=$('hs');
    G.history.slice().reverse().forEach(function(info){
      var c=info.v>=5?'g':info.v>=1.5?'y':'r';
      var d=document.createElement('div');d.className='hc '+c;d.textContent=info.v.toFixed(2)+'×';d.style.cursor='pointer';
      d.onclick=(function(i){return function(){showRoundInfo(i)}})(info);
      e.insertBefore(d,e.firstChild);while(e.children.length>16)e.removeChild(e.lastChild);
    });
  }else{
    [1.45,3.22,1.00,7.88,2.11,1.67,12.55,1.00,4.33,2.89].forEach(function(v){addHist(v)});
  }
})();
updBal();
startBettingPhase();
populateTopTab();
if(_prevRoundData.length>0)populatePrevTab();
// Show avatar picker on first visit
if(!sessionStorage.getItem('skydrop_avatar_set')){
  setTimeout(function(){openAvatarModal()},600);
}
requestAnimationFrame(update);
render();

// Init audio on first user interaction
function _initAudio(){
  sfx.init();sfx.res();
  if(sfx.musicOn&&!sfx.bgOn)sfx.startBG();
  document.removeEventListener('click',_initAudio);
  document.removeEventListener('touchstart',_initAudio);
  document.removeEventListener('keydown',_initAudio);
}
document.addEventListener('click',_initAudio);
document.addEventListener('touchstart',_initAudio);
document.addEventListener('keydown',_initAudio);
