import React, { useState } from 'react';

export function Notifications() {
  const [notifications, setNotifications] = useState([]);

  // Expose a global notify function (for simplicity)
  window.notify = function(message, type = "info") {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 6000);
  };

  return (
    <div id="notifications" style={{ position: "fixed", top: "10px", right: "10px", zIndex: 1000 }}>
      {notifications.map(n => (
        <div key={n.id} className={`notification ${n.type}`} style={{
          backgroundColor: "#fff",
          borderLeft: `5px solid ${n.type === "success" ? "green" : n.type === "error" ? "red" : "blue"}`,
          padding: "10px",
          marginBottom: "10px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
        }}>
          <div dangerouslySetInnerHTML={{ __html: n.message }}></div>
        </div>
      ))}
    </div>
  );
}
