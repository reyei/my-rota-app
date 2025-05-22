import React from 'react';
import RotaGenerator from './RotaGenerator';
import { Analytics } from "@vercel/analytics/react";

export default function App() {
    return (
      <>
        <RotaGenerator />
        <Analytics />
      </>
    );
  }
  