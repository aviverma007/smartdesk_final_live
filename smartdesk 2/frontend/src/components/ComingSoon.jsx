import React from "react";

const ComingSoon = ({ title }) => {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-blue-600 mb-4">
          Coming Soon
        </h1>
        <p className="text-xl text-gray-600">
          This feature will be available soon
        </p>
      </div>
    </div>
  );
};

export default ComingSoon;