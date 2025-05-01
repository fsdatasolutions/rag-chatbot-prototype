// frontend/src/pages/Dashboard.jsx
import React from 'react';

function Dashboard() {
    const handleLogout = () => {
        localStorage.removeItem('authToken');
        window.location.href = '/login';
    };

    return (
        <div>
            <h1>Dashboard</h1>
            <p>Welcome! You are logged in.</p>
            {/*<button onClick={handleLogout}>Log Out</button>*/}
        </div>
    );
}

export default Dashboard;