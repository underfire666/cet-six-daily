import {VocabularyPlayer} from '@/components/vocabulary/VocabularyPlayer';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <VocabularyPlayer id={id}/>;}
