import React from 'react';

import BoringDBLogo from '@/assets/logo-light.svg';
import BoringDBDarkLogo from '@/assets/logo-dark.svg';
import { useTheme } from '@/hooks/use-theme';

export const TopNavbarMock: React.FC = () => {
    const { effectiveTheme } = useTheme();
    return (
        <nav className="flex h-[105px] flex-col justify-between border-b px-3 md:h-12 md:flex-row md:items-center md:px-4">
            <div className="flex flex-1 flex-col justify-between gap-x-1 md:flex-row md:justify-normal">
                <div className="flex items-center justify-between pt-[8px] font-primary md:py-[10px]">
                    <a
                        href="https://db.getboring.io"
                        className="cursor-pointer"
                        rel="noreferrer"
                    >
                        <img
                            src={
                                effectiveTheme === 'light'
                                    ? BoringDBLogo
                                    : BoringDBDarkLogo
                            }
                            alt="BoringDB"
                            className="h-5 max-w-fit"
                        />
                    </a>
                </div>
            </div>
        </nav>
    );
};
