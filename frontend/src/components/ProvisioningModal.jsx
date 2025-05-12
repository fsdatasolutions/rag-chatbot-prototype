// frontend/src/components/ProvisioningModal.jsx
import React from 'react';
import SnakeGame from '../components/SnakeGame';
import './ProvisioningModal.css';

const ProvisioningModal = ({ show }) => {
    if (!show) return null;

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="provisioning-title">
            <div className="modal-content">
                <h2 id="provisioning-title">Setting up your account…</h2>
                <p>This usually takes less than a minute. In the meantime, enjoy a quick game of Snake 🐍</p>
                <div className="snake-wrapper">
                    <SnakeGame />
                </div>
            </div>
        </div>
    );
};

export default ProvisioningModal;