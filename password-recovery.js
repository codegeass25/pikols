(function () {
  'use strict';

  window.bindPikolPasswordRecovery = function (request, onReset) {
    var find=id=>document.getElementById(id);
    var panel=find('password-recovery'), login=find('form-login'), registration=find('form-register');
    var message=find('recovery-message'), email=find('recovery-email'), code=find('recovery-code');
    var password=find('recovery-password'), confirmation=find('recovery-confirm');
    var resend=find('recovery-resend'), countdown=find('recovery-countdown');
    var forms=['request','verify','reset'].map(name=>find('recovery-'+name+'-form'));
    var step='', target='', token='', generation=0, deadline=0, timer, pending=false;

    function announce(text,error=false) {
      message.textContent=text;
      message.classList.toggle('is-error',error);
    }
    function show(next) {
      step=next;
      panel.hidden=!next;
      forms.forEach(form=>{form.hidden=form.id!=='recovery-'+next+'-form';});
      find('recovery-start-over').hidden=!['verify','reset'].includes(next);
      find('recovery-heading').textContent=next==='success'?'Password reset successful':'Reset your password';
      find('recovery-back').textContent='Back to Login';
      if(next) ({request:email,verify:code,reset:password,success:find('recovery-back')})[next].focus();
    }
    function clear() {
      generation++;
      pending=false;
      target=token='';
      deadline=0;
      clearInterval(timer);
      forms.forEach(form=>form.reset());
      panel.removeAttribute('aria-busy');
      panel.querySelectorAll('button[type="submit"]').forEach(button=>{button.disabled=false;});
      announce('');
      show('');
    }
    function tick() {
      var seconds=Math.max(0,Math.ceil((deadline-Date.now())/1000));
      resend.disabled=pending||seconds>0;
      countdown.textContent=seconds?'You can resend in '+seconds+' seconds.':'You can resend the code now.';
      if(!seconds)clearInterval(timer);
    }
    function cooldown(seconds) {
      deadline=Date.now()+1000*seconds;
      clearInterval(timer);
      timer=setInterval(tick,1000);
      tick();
    }
    function start() {
      clear();
      login.classList.add('hidden');
      registration.classList.add('hidden');
      find('registration-result').classList.add('hidden');
      find('li-pass').value='';
      email.value=find('li-email').value.trim();
      show('request');
    }
    function back() {
      clear();
      document.querySelector('[data-authtab="login"]').click();
      find('li-email').focus();
    }
    async function send(endpoint,body,done) {
      if(pending)return;
      var epoch=generation;
      pending=true;
      panel.setAttribute('aria-busy','true');
      panel.querySelectorAll('button[type="submit"]').forEach(button=>{button.disabled=true;});
      resend.disabled=true;
      try {
        var result=await request('/api/auth/forgot-password/'+endpoint,{method:'POST',body,cache:'no-store'});
        if(epoch===generation)done(result);
      }catch(error){
        if(epoch===generation)announce(error.message,true);
      }finally{
        if(epoch===generation){
          pending=false;
          panel.removeAttribute('aria-busy');
          panel.querySelectorAll('button[type="submit"]').forEach(button=>{button.disabled=false;});
          if(step==='verify')tick();
        }
      }
    }
    function requestCode() {
      return send('request',{email:target},function(result){
        code.value='';
        show('verify');
        announce(result.message);
        cooldown(result.resend_after_seconds);
      });
    }
    forms[0].addEventListener('submit',function(event){
      event.preventDefault();
      if(pending)return;
      target=email.value.trim();
      requestCode();
    });
    forms[1].addEventListener('submit',function(event){
      event.preventDefault();
      send('verify',{email:target,code:code.value.trim()},function(result){
        token=result.reset_token;
        code.value='';
        announce('Code verified. Choose a new password.');
        show('reset');
      });
    });
    forms[2].addEventListener('submit',function(event){
      event.preventDefault();
      if(pending)return;
      if(new TextEncoder().encode(password.value).length>72){
        announce('Use a password of at most 72 UTF-8 bytes.',true);
        password.focus();
        return;
      }
      if(password.value!==confirmation.value){
        announce('Passwords do not match.',true);
        confirmation.focus();
        return;
      }
      send('reset',{reset_token:token,new_password:password.value,confirm_password:confirmation.value},function(){
        find('li-email').value=target;
        clear();
        onReset();
        login.classList.add('hidden');
        show('success');
        announce('Sign in again using your new password.');
      });
    });
    find('forgot-password').addEventListener('click',start);
    resend.addEventListener('click',requestCode);
    find('recovery-back').addEventListener('click',back);
    find('recovery-start-over').addEventListener('click',start);
    document.querySelectorAll('[data-authtab]').forEach(tab=>tab.addEventListener('click',clear));
    function close() { if(step)back(); }
    window.addEventListener('pagehide',close);
    return close;
  };
})();
