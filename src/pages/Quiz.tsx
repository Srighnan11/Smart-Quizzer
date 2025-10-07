import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight } from "lucide-react";

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: string[];
  correct_answer: string;
  difficulty: string;
  user_answer?: string;
  is_correct?: boolean;
}

const Quiz = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const fetchSession = async () => {
      const { data, error } = await supabase
        .from("quiz_sessions")
        .select("*, topics(*)")
        .eq("id", sessionId)
        .single();

      if (error || !data) {
        toast({
          title: "Error",
          description: "Quiz session not found",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setSession(data);
      await generateQuestions(data);
    };

    fetchSession();
  }, [sessionId, navigate, toast]);

  const generateQuestions = async (sessionData: any) => {
    setGenerating(true);
    try {
      const topic = sessionData.topics?.name || sessionData.custom_topic;
      const { data, error } = await supabase.functions.invoke("generate-questions", {
        body: {
          topic,
          customText: sessionData.custom_text,
          skillLevel: sessionData.skill_level,
          numQuestions: 5,
        },
      });

      if (error) throw error;

      const generatedQuestions = data.questions;

      // Insert questions into database
      const questionsToInsert = generatedQuestions.map((q: any) => ({
        session_id: sessionId,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
        correct_answer: q.correct_answer,
        difficulty: q.difficulty,
      }));

      const { data: insertedData, error: insertError } = await supabase
        .from("questions")
        .insert(questionsToInsert)
        .select();

      if (insertError) throw insertError;

      // Transform the data to match our Question interface
      const transformedQuestions = (insertedData || []).map((q) => ({
        id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: (Array.isArray(q.options) ? q.options : []).map(opt => String(opt)),
        correct_answer: q.correct_answer,
        difficulty: q.difficulty,
        user_answer: q.user_answer || undefined,
        is_correct: q.is_correct || undefined,
      }));

      setQuestions(transformedQuestions);
    } catch (error: any) {
      toast({
        title: "Error generating questions",
        description: error.message,
        variant: "destructive",
      });
      navigate("/");
    } finally {
      setGenerating(false);
      setLoading(false);
    }
  };

  const handleAnswer = async () => {
    if (!selectedAnswer) {
      toast({
        title: "Please select an answer",
        variant: "destructive",
      });
      return;
    }

    const currentQuestion = questions[currentIndex];
    const isCorrect = selectedAnswer === currentQuestion.correct_answer;

    const { error } = await supabase
      .from("questions")
      .update({
        user_answer: selectedAnswer,
        is_correct: isCorrect,
      })
      .eq("id", currentQuestion.id);

    if (error) {
      toast({
        title: "Error saving answer",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    const updatedQuestions = [...questions];
    updatedQuestions[currentIndex] = {
      ...currentQuestion,
      user_answer: selectedAnswer,
      is_correct: isCorrect,
    };
    setQuestions(updatedQuestions);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer("");
    } else {
      await completeQuiz(updatedQuestions);
    }
  };

  const completeQuiz = async (finalQuestions: Question[]) => {
    const score = finalQuestions.filter((q) => q.is_correct).length;

    const { error } = await supabase
      .from("quiz_sessions")
      .update({
        status: "completed",
        score,
        total_questions: finalQuestions.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (error) {
      toast({
        title: "Error completing quiz",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    navigate(`/results/${sessionId}`);
  };

  if (loading || generating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-lg">
              {generating ? "Generating your quiz questions..." : "Loading..."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center">No questions available</p>
            <Button onClick={() => navigate("/")} className="w-full mt-4">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="container mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Exit Quiz
          </Button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span
              className={`text-sm font-medium px-2 py-1 rounded ${
                currentQuestion.difficulty === "Easy"
                  ? "bg-difficulty-easy/10 text-difficulty-easy"
                  : currentQuestion.difficulty === "Medium"
                  ? "bg-difficulty-medium/10 text-difficulty-medium"
                  : "bg-difficulty-hard/10 text-difficulty-hard"
              }`}
            >
              {currentQuestion.difficulty}
            </span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{currentQuestion.question_text}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={selectedAnswer} onValueChange={setSelectedAnswer}>
              {currentQuestion.options.map((option, index) => (
                <div key={index} className="flex items-center space-x-2 p-3 rounded border hover:bg-muted/50">
                  <RadioGroupItem value={option} id={`option-${index}`} />
                  <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <Button onClick={handleAnswer} className="w-full" size="lg">
              {currentIndex < questions.length - 1 ? (
                <>
                  Next Question
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              ) : (
                "Finish Quiz"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Quiz;