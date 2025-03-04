import { useEffect } from 'react';

function useOutsideClick(ref, callback, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        callback();
      }
    }
    
    // Bind the event listener
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      // Unbind the event listener on clean up
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ref, callback, enabled]);
}

export default useOutsideClick;