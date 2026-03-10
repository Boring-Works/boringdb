import React from 'react';
import { Helmet } from 'react-helmet-async';

export const HelmetData: React.FC = () => (
    <Helmet>
        <meta
            name="description"
            content="Database schema designer. Visualize, design, and export your database diagrams. Supports PostgreSQL, MySQL, SQLite, SQL Server, and more."
        />
        <meta property="og:type" content="website" />
        <meta
            property="og:title"
            content="BoringDB - Database Schema Designer"
        />
        <meta
            property="og:description"
            content="Database schema designer. Visualize, design, and export your database diagrams."
        />
        <meta property="og:url" content="https://db.getboring.io" />
        <meta name="twitter:card" content="summary" />
        <meta
            name="twitter:title"
            content="BoringDB - Database Schema Designer"
        />
        <meta
            name="twitter:description"
            content="Database schema designer. Visualize, design, and export your database diagrams."
        />
        <title>BoringDB - Database Schema Designer</title>
    </Helmet>
);
