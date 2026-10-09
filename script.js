const modal = document.querySelector('.video-modal');
const video = modal.querySelector('video');

function openVideo() {
  modal.showModal();
  video.play().catch(() => {});
}

document.querySelectorAll('[data-play-video]').forEach((element) => {
  element.addEventListener('click', openVideo);
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openVideo();
    }
  });
});

document.querySelector('.modal-close').addEventListener('click', () => modal.close());
modal.addEventListener('click', (event) => {
  if (event.target === modal) modal.close();
});
modal.addEventListener('close', () => {
  video.pause();
  video.currentTime = 0;
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
document.getElementById('year').textContent = new Date().getFullYear();
window.addEventListener('scroll', () => document.querySelector('.nav-wrap').classList.toggle('scrolled', window.scrollY > 16));

const glow = document.querySelector('.cursor-glow');
window.addEventListener('pointermove', (event) => {
  glow.animate({ left: `${event.clientX}px`, top: `${event.clientY}px` }, {
    duration: 700,
    fill: 'forwards',
    easing: 'cubic-bezier(.2,.7,.2,1)'
  });
});
