const $=selector=>document.querySelector(selector);
const params=new URLSearchParams(location.search);
let mode=['update'].includes(params.get('mode'))?'update':'signin',session=null,busy=false;
function message(text,error=false){$('#login-status').textContent=text;$('#login-status').dataset.error=String(error);}
function render(){
 const authenticated=!!session?.authenticated,updating=mode==='update',showForm=!authenticated||updating;
 $('#login-heading').textContent=updating?'A fresh password.':authenticated?'Welcome back.':mode==='signup'?'Make yourself at home.':mode==='reset'?'Let’s get you back in.':'Welcome to SnapBack.';
 $('#login-intro').textContent=authenticated&&!updating?'You’re signed in as '+session.displayName+'.':mode==='signup'?'Create your free SnapBack account. No ChatGPT account needed.':mode==='reset'?'We’ll email you a link to choose a new password.':updating?'Choose a new password for your SnapBack account.':'Sign in with your email and password for free AI comparisons.';
 $('.auth-tabs').hidden=authenticated||updating;$('#email-form').hidden=!showForm;$('#forgot-password').hidden=mode!=='signin'||authenticated;
 $('#auth-fields').disabled=busy||!session?.configured;
 $('#email-field').hidden=updating;$('#account-email').disabled=updating;$('#account-email').required=!updating;
 $('#password-field').hidden=mode==='reset';$('#account-password').disabled=mode==='reset';$('#account-password').required=mode!=='reset';
 $('#confirm-field').hidden=!['signup','update'].includes(mode);$('#account-confirm').disabled=!['signup','update'].includes(mode);$('#account-confirm').required=['signup','update'].includes(mode);
 $('#password-help').hidden=!['signup','update'].includes(mode);$('#account-password').minLength=['signup','update'].includes(mode)?12:1;$('#account-password').autocomplete=['signup','update'].includes(mode)?'new-password':'current-password';
 $('#account-submit').textContent=busy?'Please wait…':({signin:'Sign in ↗',signup:'Create account ↗',reset:'Send reset email ↗',update:'Save new password ↗'})[mode];
 $('#signin-tab').classList.toggle('active',mode==='signin'||mode==='reset');$('#signup-tab').classList.toggle('active',mode==='signup');
 $('#login-library').hidden=!authenticated;$('#login-library').href=session?.returnTo||'/';$('#login-sign-out').hidden=!authenticated;$('#login-sign-out').disabled=busy;
 $('#guest-link').href=session?.returnTo||'/';$('#guest-link').hidden=authenticated;
}
function setMode(next){mode=next;$('#account-password').value='';$('#account-confirm').value='';$('#account-password').type='password';$('#show-password').textContent='Show';$('#show-password').setAttribute('aria-pressed','false');message(session?.configured?'No subscription or payment details needed.':'Email accounts are being set up. Your local photo library is available without signing in.');render();}
async function refresh(){
 message('Checking account service…');$('#login-retry').hidden=true;
 try{
  const response=await fetch('/api/auth/session?return_to='+encodeURIComponent(params.get('return_to')||'/'),{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Account status could not be checked. Please try again.');session=await response.json();
  if(!session.configured){message('Email accounts are being set up. You can still upload and compare photos manually in your local library.');$('#login-retry').hidden=false;}
  else if(params.has('error'))message('That email link could not be verified. Open the newest email in the same browser, or request a new reset link.',true);
  else if(mode==='update'&&!session.authenticated)message('Open the reset link from your email first. Use the same browser that requested it.',true);
  else message(session.authenticated?'Signed in securely. Free AI is available within shared usage limits.':'No subscription or payment details needed.');
 }catch(error){session=null;message(error.message,true);$('#login-retry').hidden=false;}
 render();
}
async function post(action,body){
 const response=await fetch('/api/auth/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 let data;try{data=await response.json();}catch{throw Error('The account service returned an unreadable response. Please try again.');}
 if(!response.ok)throw Error(data.message||'The account service is unavailable.');return data;
}
$('#email-form').onsubmit=async event=>{
 event.preventDefault();if(busy||!session?.configured)return;
 if(['signup','update'].includes(mode)&&$('#account-password').value!==$('#account-confirm').value){message('The passwords do not match.',true);return;}
 const body={email:$('#account-email').value,password:$('#account-password').value,returnTo:session.returnTo};busy=true;render();
 try{
  const data=await post(mode,body);$('#account-password').value='';$('#account-confirm').value='';
  if(data.redirect){const target=new URL(data.redirect,location.origin);if(target.origin!==location.origin)throw Error('Invalid account return address.');location.assign(target.href);return;}
  message(data.message);
 }catch(error){message(error.message,true);$('#account-password').value='';$('#account-confirm').value='';}
 finally{busy=false;render();}
};
$('#login-sign-out').onclick=async()=>{if(busy)return;busy=true;render();try{await post('signout',{});location.assign('/login');}catch(error){message(error.message,true);}finally{busy=false;render();}};
$('#show-password').onclick=()=>{const show=$('#account-password').type==='password';$('#account-password').type=show?'text':'password';$('#show-password').textContent=show?'Hide':'Show';$('#show-password').setAttribute('aria-label',show?'Hide password':'Show password');$('#show-password').setAttribute('aria-pressed',String(show));};
$('#signin-tab').onclick=()=>{if(!busy)setMode('signin');};$('#signup-tab').onclick=()=>{if(!busy)setMode('signup');};$('#forgot-password').onclick=()=>{if(!busy)setMode('reset');};$('#login-retry').onclick=refresh;render();refresh();
