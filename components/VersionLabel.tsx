
import React from 'react';
import { useVersionCheck } from '../src/hooks/useVersionCheck';

interface VersionLabelProps {
    className?: string;
    prefix?: string;
}

const VersionLabel: React.FC<VersionLabelProps> = ({ className = '', prefix = 'Phiên bản :' }) => {
    const { currentVersion } = useVersionCheck(0); // 0 = no auto check, just initial load

    if (!currentVersion) return null;

    const formatVersion = (v: string) => {
        const parts = v.split('.');
        // Requirement: "Sẽ bắt đầt đầu bằng Phiên bản : 1.0"
        // If version is 1.0.0, return 1.0
        if (parts.length >= 2) {
            return `${parts[0]}.${parts[1]}`;
        }
        return v;
    };

    return (
        <span className={`${className}`}>
            {prefix} {formatVersion(currentVersion.version)}
        </span>
    );
};

export default VersionLabel;
