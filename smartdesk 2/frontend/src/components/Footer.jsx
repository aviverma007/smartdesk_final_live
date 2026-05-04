import React from "react";

const Footer = () => {
  return (
    <footer className="bg-white shadow-inner border-t border-blue-200 mt-4">
      <div className="w-full px-4 py-3 flex flex-col items-center">
        
        <p className="text-xs text-blue-700 font-semibold tracking-wide">
          © {new Date().getFullYear()} SmartDesk — All Rights Reserved
        </p>

        <p className="text-[10px] text-gray-500 mt-1">
          Designed & Developed by Anirudh Verma
        </p>

      </div>
    </footer>
  );
};

export default Footer;
