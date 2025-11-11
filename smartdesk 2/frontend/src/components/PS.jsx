import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const PS = () => {
  return (
    <div className="space-y-6">
      <Card className="border-blue-200 shadow-sm bg-white">
        <CardHeader className="pb-4 bg-blue-50">
          <CardTitle className="text-2xl font-bold text-blue-900">PS</CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-blue-900 mb-4">Hello Smartians</h2>
            <p className="text-blue-600">Welcome to the PS section</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PS;