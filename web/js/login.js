// اسکریپت موقت برای پیش‌نمایش - نسخه واقعی بعداً با اتصال به پایتون کامل می‌شود
document.getElementById('authLogoIcon').innerHTML = ICONS.patients;
document.getElementById('firstRunHint').classList.remove('hidden');

document.getElementById('togglePwd').innerHTML = ICONS.eye;
document.getElementById('togglePwd').addEventListener('click', function() {
  const pwd = document.getElementById('password');
  const isPwd = pwd.type === 'password';
  pwd.type = isPwd ? 'text' : 'password';
  this.innerHTML = isPwd ? ICONS.eyeOff : ICONS.eye;
});
