import { Footer } from '../Footer';
import { Header } from '../Header';

interface Props {
  children: React.ReactNode;
}

export default function Layout({ children }: Props) {
  return (
    <div className='flex flex-col min-h-screen'>
      <Header />

      <main className='flex-1 pt-20'>{children}</main>

      <Footer />
    </div>
  );
}
