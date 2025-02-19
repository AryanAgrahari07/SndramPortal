import React from "react";
import { Layout } from "../components/Layout";
import { useNavigate } from "react-router-dom";
import { DashboardCard } from "../components/DashboardCard";
import { Database } from "lucide-react";
const DashboardPage: React.FC = () => {
  const firstName = localStorage.getItem("firstName") || "User";
  const navigate = useNavigate();

  const cards = [
    {
      title: "Data Management",
      description: "Access and manage fund data with ease",
      icon: (
        <Database className="w-6 h-6 text-[#2962FF] group-hover:text-white" />
      ),
      onClick: () => navigate("/tables"),
    },
    // {
    //   title: "User Administration",
    //   description: "Manage user roles and permissions",
    //   icon: <Users className="w-6 h-6 text-[#2962FF] group-hover:text-white" />,
    //   onClick: () => navigate("/users"),
    // },
    // {
    //   title: "Secure Operations",
    //   description: "Enterprise-grade security for all operations",
    //   icon: (
    //     <Shield className="w-6 h-6 text-[#2962FF] group-hover:text-white" />
    //   ),
    //   onClick: () => navigate("/security"),
    // },
  ];

  return (
    <Layout>
      <div className="space-y-8 p-8">
        <div>
          <h1 className="text-3xl font-bold text-[#1A237E]">
            Hello, <span className="text-[#00BFA5]">{firstName}</span>
          </h1>
          <p className="text-[#212121] mt-2">
            Access powerful tools and insights to manage your operations
            efficiently and effectively
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card, index) => (
            <DashboardCard
              key={index}
              title={card.title}
              description={card.description}
              icon={card.icon}
              onClick={card.onClick}
            />
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default DashboardPage;
