import {VocabularyComplete} from '@/components/vocabulary/VocabularyComplete';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <VocabularyComplete id={id}/>;}
