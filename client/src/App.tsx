import { LazyMotion, MotionConfig, domAnimation } from "framer-motion";
import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { routes } from "@/routes";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  return (
    // reducedMotion="user": transform animations are disabled when the OS asks for less motion.
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict={false}>
        <Layout>
          <ScrollToTop />
          <Routes>
            {routes.map((r) => (
              <Route key={r.path} path={r.path} element={r.element} />
            ))}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Layout>
      </LazyMotion>
    </MotionConfig>
  );
}
