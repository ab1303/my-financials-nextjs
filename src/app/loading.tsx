import Loading from '@/components/Loading';

type LoadingProps = {
  loadingText?: string;
};

const PageLoading = ({ loadingText }: LoadingProps) => {
  return (
    <div className='flex items-center justify-center h-screen shadow-lg shadow-cyan-500 border-2'>
      <Loading loadingText={loadingText} />
    </div>
  );
};

export default PageLoading;
