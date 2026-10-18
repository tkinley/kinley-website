// Classic script so a double-clicked file can explain why modules cannot start.
// It does not read the document picker or profile.
if (window.location.protocol === 'file:') {
  const showLocalHelp = () => {
    const note = document.createElement('p');
    note.className = 'error-note';
    note.id = 'local-preview-help';
    note.setAttribute('role', 'alert');
    note.textContent = 'To use this local preview, open a terminal in the website folder and run: node scripts/serve-student-match.mjs. Then visit http://127.0.0.1:4173/student-match.html. This page needs an HTTP server for its local data and document parsers. The original resource directory is still available from the link below.';
    document.querySelector('.hero').append(note);
    document.querySelectorAll('button, input, select, textarea').forEach(control => { control.disabled = true; });
    document.getElementById('result-count').textContent = 'Start a local HTTP preview to load the resource directory.';
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showLocalHelp, { once: true });
  else showLocalHelp();
}
