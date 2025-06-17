import { companyInfo } from "@/features/landing/data/company-info";
import { cn } from "@/lib/utils";
import Link from "next/link";

const Logo = ({ scrolled = false }: { scrolled?: boolean }) => {
  return (
    <Link
      href="/"
      className="flex items-center space-x-2"
    >
      <div className="w-16 h-10 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center">
        <span className="text-white font-bold text-xl font-serif">TPR</span>
      </div>
      <div
        className={cn(
          "flex flex-col transition duration-300",
          scrolled ? "text-foreground" : "text-foreground"
        )}
      >
        <span className="font-serif font-bold text-xl">{companyInfo.name}</span>
        <span className="text-sm -mt-1">Reimagine Construction</span>
      </div>
    </Link>
  );
};
export default Logo;
