const $=selector=>document.querySelector(selector);
async function refresh(){
 for(const id of ['login-continue','login-library','login-hosted','login-sign-out','login-retry'])$('#'+id).hidden=true;
 $('#login-status').textContent='Checking sign-in…';
 try{
  const value=new URLSearchParams(location.search).get('return_to')||'/';
  const response=await fetch('/api/auth/session?return_to='+encodeURIComponent(value),{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Sign-in is temporarily unavailable. Your local library is still available.');
  const session=await response.json();
  $('#guest-link').href=session.returnTo;
  if(!session.authAvailable){$('#login-status').textContent='This local preview has no sign-in service. Open the hosted app to sign in, or use your local library below.';$('#login-hosted').hidden=false;}
  else if(session.authenticated){
   $('#login-heading').textContent='Welcome back.';$('#login-intro').textContent='You’re signed in as '+session.displayName+'.';
   $('#login-status').textContent='Your free AI access is ready, within shared usage limits.';
   $('#login-library').href=session.returnTo;$('#login-library').hidden=false;$('#login-sign-out').href=session.signOutPath;$('#login-sign-out').hidden=false;$('#guest-link').hidden=true;
  }else{$('#login-status').textContent='Free sign-in. No subscription or payment details.';$('#login-continue').href=session.signInPath;$('#login-continue').hidden=false;}
 }catch(error){$('#login-status').textContent=error.message;$('#login-retry').hidden=false;}
}
$('#login-retry').onclick=refresh;refresh();
